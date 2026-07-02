import { Hono } from "hono";
import type { Bindings, Env } from "./env";
import { parseFrontmatter } from "./frontmatter";
import { signRawToken } from "./auth";

export const notes = new Hono<Bindings>();

interface NoteRow {
  id: string;
  folder_id: string;
  title: string;
  format: "md" | "html";
  frontmatter: string | null;
  r2_key: string;
  etag: string;
  created_at: number;
  updated_at: number;
}

interface WritePayload {
  folder?: unknown;
  title?: unknown;
  format?: unknown;
  content?: unknown;
  frontmatter?: unknown;
}

const META_COLUMNS =
  "id, folder_id, title, format, frontmatter, r2_key, etag, created_at, updated_at";

function toMeta(row: NoteRow) {
  return {
    id: row.id,
    folder_id: row.folder_id,
    title: row.title,
    format: row.format,
    frontmatter: row.frontmatter
      ? (JSON.parse(row.frontmatter) as Record<string, unknown>)
      : null,
    etag: row.etag,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Agents may address folders by id or by name. */
async function resolveFolder(env: Env, ref: string) {
  return env.DB.prepare("SELECT id FROM folders WHERE id = ?1 OR name = ?1")
    .bind(ref)
    .first<{ id: string }>();
}

function contentTypeFor(format: "md" | "html"): string {
  return format === "html"
    ? "text/html; charset=utf-8"
    : "text/markdown; charset=utf-8";
}

/**
 * Merge frontmatter parsed from the file with any explicitly supplied object
 * (explicit fields win). For html notes there is no parsing — the agent
 * supplies fields explicitly.
 */
function deriveFrontmatter(
  format: "md" | "html",
  content: string,
  supplied: unknown,
): Record<string, unknown> | null {
  const parsed = format === "md" ? parseFrontmatter(content) : null;
  const explicit =
    supplied && typeof supplied === "object" && !Array.isArray(supplied)
      ? (supplied as Record<string, unknown>)
      : null;
  if (!parsed && !explicit) return null;
  return { ...parsed, ...explicit };
}

function titleFrom(
  payloadTitle: unknown,
  frontmatter: Record<string, unknown> | null,
  fallback: string,
): string {
  if (typeof payloadTitle === "string" && payloadTitle.trim()) {
    return payloadTitle.trim();
  }
  if (typeof frontmatter?.title === "string" && frontmatter.title.trim()) {
    return frontmatter.title.trim();
  }
  return fallback;
}

function stripWeakQuotes(etag: string): string {
  return etag.replace(/^W\//, "").replace(/^"|"$/g, "");
}

notes.get("/", async (c) => {
  const folder = c.req.query("folder");
  const stmt = folder
    ? c.env.DB.prepare(
        `SELECT ${META_COLUMNS} FROM notes WHERE folder_id = ? ORDER BY updated_at DESC`,
      ).bind(folder)
    : c.env.DB.prepare(
        `SELECT ${META_COLUMNS} FROM notes ORDER BY updated_at DESC`,
      );
  const { results } = await stmt.all<NoteRow>();
  return c.json({ notes: results.map(toMeta) });
});

notes.get("/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT ${META_COLUMNS} FROM notes WHERE id = ?`,
  )
    .bind(c.req.param("id"))
    .first<NoteRow>();
  if (!row) return c.json({ error: "Note not found" }, 404);

  const obj = await c.env.BUCKET.get(row.r2_key);
  const content = obj ? await obj.text() : "";
  c.header("ETag", `"${row.etag}"`);
  return c.json({ ...toMeta(row), content });
});

notes.post("/", async (c) => {
  const body = await c.req.json<WritePayload>().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);

  const format = body.format;
  if (format !== "md" && format !== "html") {
    return c.json({ error: "format must be 'md' or 'html'" }, 400);
  }
  if (typeof body.content !== "string") {
    return c.json({ error: "content is required" }, 400);
  }
  const folderRef = typeof body.folder === "string" ? body.folder : "";
  const folder = folderRef ? await resolveFolder(c.env, folderRef) : null;
  if (!folder) return c.json({ error: "Folder not found" }, 404);

  const frontmatter = deriveFrontmatter(format, body.content, body.frontmatter);
  const title = titleFrom(body.title, frontmatter, "Untitled");

  const id = crypto.randomUUID();
  const r2Key = `notes/${id}.${format}`;
  const etag = await sha256Hex(body.content);
  const now = Date.now();

  await c.env.BUCKET.put(r2Key, body.content, {
    httpMetadata: { contentType: contentTypeFor(format) },
  });
  await c.env.DB.prepare(
    `INSERT INTO notes (id, folder_id, title, format, frontmatter, r2_key, etag, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      folder.id,
      title,
      format,
      frontmatter ? JSON.stringify(frontmatter) : null,
      r2Key,
      etag,
      now,
      now,
    )
    .run();

  c.header("ETag", `"${etag}"`);
  return c.json(
    {
      id,
      folder_id: folder.id,
      title,
      format,
      frontmatter,
      etag,
      created_at: now,
      updated_at: now,
    },
    201,
  );
});

notes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT ${META_COLUMNS} FROM notes WHERE id = ?`,
  )
    .bind(id)
    .first<NoteRow>();
  if (!row) return c.json({ error: "Note not found" }, 404);

  const ifMatch = c.req.header("If-Match");
  if (!ifMatch) {
    return c.json(
      { error: "If-Match header is required to save (send the note's etag)" },
      428,
    );
  }
  if (stripWeakQuotes(ifMatch) !== row.etag) {
    return c.json(
      {
        error:
          "This note changed since you loaded it. Pull the latest version before saving.",
      },
      412,
    );
  }

  const body = await c.req.json<WritePayload>().catch(() => null);
  if (!body) return c.json({ error: "Invalid JSON body" }, 400);
  if (typeof body.content !== "string") {
    return c.json({ error: "content is required" }, 400);
  }
  if (body.format !== undefined && body.format !== row.format) {
    return c.json({ error: "format cannot be changed" }, 400);
  }

  let folderId = row.folder_id;
  if (typeof body.folder === "string" && body.folder) {
    const folder = await resolveFolder(c.env, body.folder);
    if (!folder) return c.json({ error: "Folder not found" }, 404);
    folderId = folder.id;
  }

  const frontmatter = deriveFrontmatter(
    row.format,
    body.content,
    body.frontmatter,
  );
  const title = titleFrom(body.title, frontmatter, row.title);
  const etag = await sha256Hex(body.content);
  const now = Date.now();

  await c.env.BUCKET.put(row.r2_key, body.content, {
    httpMetadata: { contentType: contentTypeFor(row.format) },
  });
  await c.env.DB.prepare(
    `UPDATE notes SET folder_id = ?, title = ?, frontmatter = ?, etag = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(
      folderId,
      title,
      frontmatter ? JSON.stringify(frontmatter) : null,
      etag,
      now,
      id,
    )
    .run();

  c.header("ETag", `"${etag}"`);
  return c.json({
    id,
    folder_id: folderId,
    title,
    format: row.format,
    frontmatter,
    etag,
    created_at: row.created_at,
    updated_at: now,
  });
});

notes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT r2_key FROM notes WHERE id = ?")
    .bind(id)
    .first<{ r2_key: string }>();
  if (!row) return c.json({ error: "Note not found" }, 404);

  await c.env.BUCKET.delete(row.r2_key);
  await c.env.DB.prepare("DELETE FROM notes WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

// Mints the short-lived token the UI puts in the sandboxed iframe's src.
notes.post("/:id/raw-token", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT id FROM notes WHERE id = ?")
    .bind(id)
    .first();
  if (!row) return c.json({ error: "Note not found" }, 404);
  return c.json(await signRawToken(c.env.API_KEY, id));
});
