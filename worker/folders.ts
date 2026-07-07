import { Hono } from "hono";
import type { Bindings } from "./env";

export const folders = new Hono<Bindings>();

folders.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, created_at FROM folders ORDER BY created_at",
  ).all();
  return c.json({ folders: results });
});

folders.post("/", async (c) => {
  const body = await c.req.json<{ name?: unknown }>().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return c.json({ error: "name is required" }, 400);

  const id = crypto.randomUUID();
  const createdAt = Date.now();
  try {
    await c.env.DB.prepare(
      "INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)",
    )
      .bind(id, name, createdAt)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return c.json({ error: `Folder "${name}" already exists` }, 409);
    }
    throw err;
  }
  return c.json({ id, name, created_at: createdAt }, 201);
});

folders.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const folder = await c.env.DB.prepare("SELECT id FROM folders WHERE id = ?")
    .bind(id)
    .first();
  if (!folder) return c.json({ error: "Folder not found" }, 404);

  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM notes WHERE folder_id = ?",
  )
    .bind(id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) > 0) {
    return c.json({ error: "Folder is not empty" }, 409);
  }

  await c.env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});
