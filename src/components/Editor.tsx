import { useState } from "react";
import {
  ApiError,
  getNote,
  updateNote,
  type Note,
  type NoteMeta,
} from "../api/client";

/**
 * Raw-markdown editor with explicit Save. Save sends If-Match with the etag
 * the note was loaded at; a 412 means someone (likely the agent) rewrote the
 * note in the meantime, and the user must pull the latest before saving.
 */
export function Editor({
  note,
  onSaved,
  onCancel,
}: {
  note: Note;
  onSaved: (meta: NoteMeta, content: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(note.content);
  const [etag, setEtag] = useState(note.etag);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const meta = await updateNote(note.id, { content: text }, etag);
      onSaved(meta, text);
    } catch (err) {
      if (err instanceof ApiError && err.status === 412) {
        setConflict(true);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function loadLatest() {
    try {
      const latest = await getNote(note.id);
      setText(latest.content);
      setEtag(latest.etag);
      setConflict(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-cream-200 bg-cream-50/60 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          Editing
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-cream-100"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-ink-900 px-4 py-1.5 text-sm font-semibold text-cream-50 hover:bg-ink-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {conflict && (
        <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>
            This note changed since you opened it. Pull the latest version
            before saving — your current edits will be discarded.
          </span>
          <button
            onClick={loadLatest}
            className="ml-auto shrink-0 rounded-lg border border-amber-400 bg-white px-3 py-1 font-semibold hover:bg-amber-100"
          >
            Load latest
          </button>
        </div>
      )}
      {error && (
        <div className="border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            void save();
          }
        }}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-white px-6 py-5 font-mono text-sm leading-relaxed text-ink-900 outline-none"
      />
    </div>
  );
}
