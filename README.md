# Agent Notes

A personal, single-user notes app in the style of Apple Notes, where **notes
are files** and **an agent is a first-class author** working on files.

- Each note is a `.md` file (Markdown + frontmatter, with rich blocks via
  directives) or a `.html` file (a self-contained, possibly interactive
  document). Both live in the same folders and the same sidebar.
- A research agent writes notes through the same HTTP API the UI uses,
  authenticated with the same bearer key.

Built as a Vite + React PWA (Tailwind) served by a single Cloudflare Worker,
with **D1** for metadata (folders, note index, frontmatter) and **R2** for the
raw file bodies (`notes/{id}.md` / `notes/{id}.html`).

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars        # set API_KEY to anything you like
npm run db:migrate                    # applies migrations to the local D1
npm run dev                           # http://localhost:5173
```

Open the app and paste the same `API_KEY` value from `.dev.vars` — the UI
stores it in localStorage and sends it as `Authorization: Bearer` on every
request, exactly like the agent does.

## Deploying

```sh
npx wrangler d1 create notes-db       # put the returned id in wrangler.jsonc
npx wrangler r2 bucket create agent-note-bodies
npx wrangler secret put API_KEY       # the shared bearer key
npm run db:migrate:remote
npm run deploy
```

## The API (what the agent calls)

All `/api/*` routes require `Authorization: Bearer $API_KEY`.

```sh
# folders
curl -H "Authorization: Bearer $KEY" https://<host>/api/folders
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"name":"research"}' https://<host>/api/folders
curl -X DELETE -H "Authorization: Bearer $KEY" https://<host>/api/folders/<id>   # 409 if non-empty

# notes
curl -H "Authorization: Bearer $KEY" "https://<host>/api/notes"                  # all notes (metadata)
curl -H "Authorization: Bearer $KEY" "https://<host>/api/notes?folder=<id>"
curl -H "Authorization: Bearer $KEY" https://<host>/api/notes/<id>               # metadata + body + ETag

# create a markdown note (folder may be an id or a name)
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"folder":"research","format":"md","content":"---\ntitle: Findings\ntags: [edge]\n---\n\n# Findings\n"}' \
  https://<host>/api/notes

# create an html artifact (title/frontmatter supplied explicitly — html is never parsed)
curl -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"folder":"research","title":"map","format":"html","content":"<!doctype html>..."}' \
  https://<host>/api/notes

# replace (Save). If-Match is REQUIRED; a stale etag returns 412 —
# pull the latest note (GET) and retry.
curl -X PUT -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H 'If-Match: "<etag from GET>"' \
  -d '{"content":"---\ntitle: Findings\n---\n\n# v2\n"}' \
  https://<host>/api/notes/<id>

curl -X DELETE -H "Authorization: Bearer $KEY" https://<host>/api/notes/<id>
```

Notes on write semantics:

- `format` ∈ `md | html`, fixed at creation (it drives the render path).
- For `md`, frontmatter is parsed out of `content` on save and denormalized
  into D1; explicitly supplied `frontmatter` fields win over parsed ones.
  `title` falls back to `frontmatter.title`.
- Saves are whole-file replaces. There is no autosave or partial patch.

## Markdown rich blocks (directives)

Markdown is rendered as data: parsed with remark, mapped onto a **fixed
vocabulary** of components, and passed through `rehype-sanitize` (raw HTML,
scripts, and event handlers are stripped). Available directives:

```md
:::callout{type="warning" title="Heads up"}
Cache invalidation is hard.
:::
```

`type` ∈ `info | warning | danger | tip`.

## HTML notes and the sandbox

`.html` notes are **contained, not sanitized**. The UI renders them in
`<iframe sandbox="allow-scripts">` (never `allow-same-origin`), pointed at
`GET /raw/:id?token=…`. The token is minted by
`POST /api/notes/:id/raw-token` — HMAC-signed, scoped to that one note, valid
for two minutes — so the API key itself never appears in a URL the framed
document could read. The `/raw` response also carries a strict
`Content-Security-Policy` (`sandbox allow-scripts`, `connect-src 'none'`), so
scripts inside the note run but cannot fetch out, read the app's storage, or
touch the parent DOM. HTML notes are read-only in the UI.

**Production hardening (when this leaves your laptop):** serve `/raw` from a
separate origin (`sandbox.<domain>` routed to this same Worker) so the
browser's same-origin policy is a second, independent wall in front of any
sandbox-attribute mistake.

## Layout

```
worker/        Hono API: auth, folders, notes, /raw streaming (D1 + R2)
src/           React PWA: sidebar, render router (md inline / html iframe), editor
migrations/    D1 schema
wrangler.jsonc bindings (DB, BUCKET, ASSETS) + SPA assets w/ run_worker_first
```
