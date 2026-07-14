import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createFolder,
  createNote,
  deleteFolder,
  deleteNote,
  getApiKey,
  getNote,
  listFolders,
  listNotes,
  setApiKey,
  type Folder,
  type Note,
  type NoteMeta,
} from "./api/client";
import { ApiKeyGate } from "./components/ApiKeyGate";
import { Sidebar } from "./components/Sidebar";
import { NoteView } from "./components/NoteView";
import { Editor } from "./components/Editor";
import { DropZone } from "./components/DropZone";

export default function App() {
  const [key, setKey] = useState<string | null>(getApiKey());
  if (!key) {
    return <ApiKeyGate onUnlocked={setKey} />;
  }
  return (
    <Workspace
      onChangeKey={() => {
        setApiKey(null);
        setKey(null);
      }}
    />
  );
}

function Workspace({ onChangeKey }: { onChangeKey: () => void }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<NoteMeta[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [editing, setEditing] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        onChangeKey(); // key was revoked/changed — back to the gate
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    },
    [onChangeKey],
  );

  const refresh = useCallback(async () => {
    try {
      const [f, n] = await Promise.all([listFolders(), listNotes()]);
      setFolders(f);
      setNotes(n);
      setError(null);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function selectNote(id: string) {
    setMobileNavOpen(false);
    try {
      setEditing(false);
      setDropOpen(false);
      setNote(await getNote(id));
    } catch (err) {
      handleError(err);
    }
  }

  function openUpload() {
    setNote(null);
    setEditing(false);
    setError(null);
    setDropOpen(true);
    setMobileNavOpen(false);
  }

  async function handleCreateFolder(name: string) {
    try {
      await createFolder(name);
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }

  async function handleDeleteFolder(id: string) {
    const folder = folders.find((f) => f.id === id);
    if (!window.confirm(`Delete folder "${folder?.name ?? id}"?`)) return;
    try {
      await deleteFolder(id);
      await refresh();
    } catch (err) {
      handleError(err); // e.g. 409 "Folder is not empty"
    }
  }

  async function handleCreateNote(folderId: string) {
    try {
      const meta = await createNote({
        folder: folderId,
        format: "md",
        content: "---\ntitle: untitled\n---\n\n",
      });
      await refresh();
      setDropOpen(false);
      setMobileNavOpen(false);
      setNote(await getNote(meta.id));
      setEditing(true);
    } catch (err) {
      handleError(err);
    }
  }

  async function handleDeleteNote() {
    if (!note) return;
    if (!window.confirm(`Delete "${note.title}.${note.format}"?`)) return;
    try {
      await deleteNote(note.id);
      setNote(null);
      setEditing(false);
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }

  function handleSaved(meta: NoteMeta, content: string) {
    setNote({ ...meta, content });
    setEditing(false);
    void refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: static column on desktop, slide-in drawer on mobile */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          folders={folders}
          notes={notes}
          selectedId={note?.id ?? null}
          onSelect={(id) => void selectNote(id)}
          onCreateFolder={handleCreateFolder}
          onCreateNote={handleCreateNote}
          onUpload={openUpload}
          onDeleteFolder={handleDeleteFolder}
          onChangeKey={onChangeKey}
        />
      </div>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden
        />
      )}

      <main className="flex min-w-0 flex-1 flex-col bg-white/60">
        {/* Mobile top bar with the drawer toggle */}
        <div className="flex items-center gap-2 border-b border-cream-200 bg-white px-3 py-2 md:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="rounded-lg px-2 py-1 text-xl leading-none text-ink-700 hover:bg-cream-100"
          >
            ☰
          </button>
          <span className="truncate text-sm font-semibold text-ink-900">
            {note
              ? `${note.title}.${note.format}`
              : dropOpen
                ? "Upload HTML"
                : "Notes"}
          </span>
        </div>

        {error && (
          <div className="flex items-center border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto font-bold hover:text-red-950"
            >
              ×
            </button>
          </div>
        )}

        {dropOpen ? (
          <DropZone
            folders={folders}
            onUploaded={() => void refresh()}
            onOpenNote={(id) => void selectNote(id)}
            onClose={() => setDropOpen(false)}
          />
        ) : note ? (
          <>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-cream-200 bg-white px-5">
              <h2 className="truncate text-base font-bold text-ink-900">
                {note.title}.{note.format}
              </h2>
              <div className="ml-auto flex items-center gap-2">
                {note.format === "md" && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-cream-100"
                  >
                    Edit
                  </button>
                )}
                {note.format === "html" && (
                  <span className="text-xs text-ink-300">
                    agent artifact · read-only
                  </span>
                )}
                <button
                  onClick={() => void handleDeleteNote()}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-red-50 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {editing ? (
                <Editor
                  key={`${note.id}:${note.etag}`}
                  note={note}
                  onSaved={handleSaved}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <NoteView note={note} />
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-ink-300">
              Select a note, or create one with the + next to a folder.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
