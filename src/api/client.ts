export interface Folder {
  id: string;
  name: string;
  created_at: number;
}

export type NoteFormat = "md" | "html";

export interface NoteMeta {
  id: string;
  folder_id: string;
  title: string;
  format: NoteFormat;
  frontmatter: Record<string, unknown> | null;
  etag: string;
  created_at: number;
  updated_at: number;
}

export interface Note extends NoteMeta {
  content: string;
}

export interface WritePayload {
  folder?: string;
  title?: string;
  format?: NoteFormat;
  content: string;
  frontmatter?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const KEY_STORAGE = "agent-note.apiKey";

export function getApiKey(): string | null {
  return localStorage.getItem(KEY_STORAGE);
}

export function setApiKey(key: string | null): void {
  if (key) localStorage.setItem(KEY_STORAGE, key);
  else localStorage.removeItem(KEY_STORAGE);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getApiKey() ?? ""}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export async function listFolders(): Promise<Folder[]> {
  const { folders } = await request<{ folders: Folder[] }>("/api/folders");
  return folders;
}

export async function createFolder(name: string): Promise<Folder> {
  return request<Folder>("/api/folders", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteFolder(id: string): Promise<void> {
  await request(`/api/folders/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function listNotes(): Promise<NoteMeta[]> {
  const { notes } = await request<{ notes: NoteMeta[] }>("/api/notes");
  return notes;
}

export async function getNote(id: string): Promise<Note> {
  return request<Note>(`/api/notes/${encodeURIComponent(id)}`);
}

export async function createNote(payload: WritePayload): Promise<NoteMeta> {
  return request<NoteMeta>("/api/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateNote(
  id: string,
  payload: WritePayload,
  etag: string,
): Promise<NoteMeta> {
  return request<NoteMeta>(`/api/notes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "If-Match": `"${etag}"` },
    body: JSON.stringify(payload),
  });
}

export async function deleteNote(id: string): Promise<void> {
  await request(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function getRawToken(
  id: string,
): Promise<{ token: string; expires_at: number }> {
  return request(`/api/notes/${encodeURIComponent(id)}/raw-token`, {
    method: "POST",
  });
}
