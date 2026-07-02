-- Folders + notes metadata. Note bodies live in R2 (key = notes/{id}.{format}).
CREATE TABLE folders (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE notes (
  id          TEXT PRIMARY KEY,
  folder_id   TEXT NOT NULL REFERENCES folders(id),
  title       TEXT NOT NULL,
  format      TEXT NOT NULL CHECK (format IN ('md', 'html')),
  frontmatter TEXT,
  r2_key      TEXT NOT NULL,
  etag        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX idx_notes_folder ON notes(folder_id);
CREATE INDEX idx_notes_updated ON notes(updated_at);

INSERT INTO folders (id, name, created_at)
VALUES ('my-notes', 'my-notes', CAST(strftime('%s', 'now') AS INTEGER) * 1000);
