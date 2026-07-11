import { useMemo, useState } from "react";
import type { Folder, NoteMeta } from "../api/client";

const COLLAPSED_STORAGE = "agent-note.collapsedFolders";

function loadCollapsed(): Set<string> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function Sidebar({
  folders,
  notes,
  selectedId,
  onSelect,
  onCreateFolder,
  onCreateNote,
  onUpload,
  onDeleteFolder,
  onChangeKey,
}: {
  folders: Folder[];
  notes: NoteMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onCreateNote: (folderId: string) => Promise<void>;
  onUpload: () => void;
  onDeleteFolder: (id: string) => Promise<void>;
  onChangeKey: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const notesByFolder = useMemo(() => {
    const map = new Map<string, NoteMeta[]>();
    for (const note of notes) {
      const list = map.get(note.folder_id) ?? [];
      list.push(note);
      map.set(note.folder_id, list);
    }
    return map;
  }, [notes]);

  function toggle(folderId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      localStorage.setItem(COLLAPSED_STORAGE, JSON.stringify([...next]));
      return next;
    });
  }

  async function submitNewFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setAddingFolder(false);
      return;
    }
    await onCreateFolder(name);
    setNewFolderName("");
    setAddingFolder(false);
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-cream-200 bg-cream-100/90">
      <div className="flex items-center gap-1 px-4 pb-2 pt-4">
        <h1 className="text-lg font-bold text-ink-900">Notes</h1>
        <button
          onClick={() => setAddingFolder(true)}
          title="New folder"
          className="ml-auto rounded-lg px-2 py-1 text-sm font-semibold text-ink-500 hover:bg-cream-200 hover:text-ink-900"
        >
          + folder
        </button>
        <button
          onClick={onUpload}
          title="Upload HTML file"
          aria-label="Upload HTML file"
          className="rounded-lg px-2 py-1 text-lg font-semibold leading-none text-ink-500 hover:bg-cream-200 hover:text-ink-900"
        >
          +
        </button>
      </div>

      {addingFolder && (
        <form
          className="px-4 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submitNewFolder();
          }}
        >
          <input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={() => void submitNewFolder()}
            placeholder="folder name"
            className="w-full rounded-lg border border-cream-300 bg-white px-2 py-1.5 text-sm outline-none"
          />
        </form>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {folders.map((folder) => {
          const folderNotes = notesByFolder.get(folder.id) ?? [];
          const isOpen = !collapsed.has(folder.id);
          return (
            <section key={folder.id} className="mb-1">
              <div className="group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-cream-200/70">
                <button
                  onClick={() => toggle(folder.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <span
                    className={`text-[10px] text-ink-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  <span className="truncate text-sm font-bold text-ink-900">
                    {folder.name}
                  </span>
                  <span className="text-xs text-ink-300">
                    {folderNotes.length}
                  </span>
                </button>
                <button
                  onClick={() => void onCreateNote(folder.id)}
                  title="New note in this folder"
                  aria-label="New note in this folder"
                  className="block rounded px-1.5 text-sm text-ink-500 hover:bg-white hover:text-ink-900 md:hidden md:group-hover:block"
                >
                  +
                </button>
                <button
                  onClick={() => void onDeleteFolder(folder.id)}
                  title="Delete folder"
                  aria-label="Delete folder"
                  className="block rounded px-1.5 text-sm text-ink-500 hover:bg-white hover:text-red-700 md:hidden md:group-hover:block"
                >
                  ×
                </button>
              </div>

              {isOpen && (
                <ul className="mt-0.5">
                  {folderNotes.map((note) => (
                    <li key={note.id}>
                      <button
                        onClick={() => onSelect(note.id)}
                        className={`w-full truncate rounded-xl px-4 py-2 text-left text-sm ${
                          note.id === selectedId
                            ? "bg-white font-semibold text-ink-900 shadow-sm"
                            : "text-ink-700 hover:bg-cream-200/70"
                        }`}
                      >
                        {note.title}.{note.format}
                      </button>
                    </li>
                  ))}
                  {folderNotes.length === 0 && (
                    <li className="px-4 py-1.5 text-xs italic text-ink-300">
                      empty
                    </li>
                  )}
                </ul>
              )}
            </section>
          );
        })}
      </nav>

      <div className="border-t border-cream-200 px-4 py-2">
        <button
          onClick={onChangeKey}
          className="text-xs text-ink-500 hover:text-ink-900"
        >
          Change API key
        </button>
      </div>
    </aside>
  );
}
