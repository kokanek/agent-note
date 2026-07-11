import { useRef, useState } from "react";
import { createNote } from "../api/client";

interface Hosted {
  id: string;
  name: string;
}

function isHtmlFile(file: File): boolean {
  return /\.html?$/i.test(file.name) || file.type === "text/html";
}

function titleFromFilename(name: string): string {
  return name.replace(/\.html?$/i, "") || "untitled";
}

/**
 * Netlify-Drop-style pane: drop one or more .html files and each becomes an
 * html note in the target folder — "hosted" via the same sandboxed /raw
 * iframe path used for agent-authored artifacts. Purely a client of the
 * existing POST /api/notes endpoint.
 */
export function DropZone({
  folderId,
  folderName,
  onUploaded,
  onOpenNote,
  onClose,
}: {
  folderId: string;
  folderName: string;
  onUploaded: () => void;
  onOpenNote: (id: string) => void;
  onClose: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hosted, setHosted] = useState<Hosted[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ingest(files: FileList | File[]) {
    const list = Array.from(files);
    const htmlFiles = list.filter(isHtmlFile);
    const rejected = list.length - htmlFiles.length;
    if (htmlFiles.length === 0) {
      setError("Only .html files can be dropped here.");
      return;
    }
    setError(rejected > 0 ? `Skipped ${rejected} non-HTML file(s).` : null);
    setBusy(true);
    try {
      for (const file of htmlFiles) {
        const content = await file.text();
        const meta = await createNote({
          folder: folderId,
          title: titleFromFilename(file.name),
          format: "html",
          content,
        });
        setHosted((prev) => [...prev, { id: meta.id, name: `${meta.title}.html` }]);
        onUploaded();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-cream-200 bg-white px-5">
        <h2 className="truncate text-base font-bold text-ink-900">
          Drop HTML into <span className="text-terra-600">{folderName}</span>
        </h2>
        <button
          onClick={onClose}
          className="ml-auto rounded-lg px-3 py-1.5 text-sm font-medium text-ink-500 hover:bg-cream-100 hover:text-ink-900"
        >
          Close
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-8">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void ingest(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragging
              ? "border-terra-600 bg-terra-100/50"
              : "border-cream-300 bg-cream-50 hover:border-ink-300 hover:bg-cream-100"
          }`}
        >
          <div className="mb-3 text-4xl">📄</div>
          <p className="text-base font-semibold text-ink-900">
            {busy ? "Uploading…" : "Drag & drop an HTML file"}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            or click to choose · it will be hosted under{" "}
            <span className="font-medium">{folderName}</span>
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void ingest(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-amber-700">{error}</p>
        )}

        {hosted.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Hosted
            </h3>
            <ul className="flex flex-col gap-1">
              {hosted.map((h) => (
                <li key={h.id}>
                  <button
                    onClick={() => onOpenNote(h.id)}
                    className="flex w-full items-center gap-2 rounded-lg border border-cream-200 bg-white px-3 py-2 text-left text-sm text-ink-700 hover:border-ink-300"
                  >
                    <span className="text-emerald-600">✓</span>
                    <span className="truncate">{h.name}</span>
                    <span className="ml-auto text-xs text-terra-600">open →</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
