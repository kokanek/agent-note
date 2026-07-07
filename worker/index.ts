import { Hono } from "hono";
import type { Bindings } from "./env";
import { requireApiKey, verifyRawToken } from "./auth";
import { folders } from "./folders";
import { notes } from "./notes";

const app = new Hono<Bindings>();

app.use("/api/*", requireApiKey);
app.route("/api/folders", folders);
app.route("/api/notes", notes);

// Raw note bodies for the sandboxed iframe. Day one this is same-origin
// behind the CSP sandbox directive; production hardening is to move it to a
// separate sandbox.<domain> origin (see README).
app.get("/raw/:id", async (c) => {
  const id = c.req.param("id");
  const token = c.req.query("token") ?? "";
  if (!(await verifyRawToken(c.env.API_KEY, id, token))) {
    return c.text("Unauthorized", 401);
  }

  const row = await c.env.DB.prepare(
    "SELECT r2_key, format FROM notes WHERE id = ?",
  )
    .bind(id)
    .first<{ r2_key: string; format: "md" | "html" }>();
  if (!row) return c.text("Not found", 404);

  const obj = await c.env.BUCKET.get(row.r2_key);
  if (!obj) return c.text("Not found", 404);

  return new Response(obj.body, {
    headers: {
      "Content-Type":
        row.format === "html"
          ? "text/html; charset=utf-8"
          : "text/plain; charset=utf-8",
      // sandbox: opaque origin even if opened directly in a tab.
      // connect-src 'none': scripts may run but cannot fetch out.
      "Content-Security-Policy":
        "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; " +
        "style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; " +
        "font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; " +
        "frame-ancestors 'self'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
});

app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/") || path.startsWith("/raw/")) {
    return c.json({ error: "Not found" }, 404);
  }
  // Everything else falls through to the SPA assets.
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
