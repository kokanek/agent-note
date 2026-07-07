import { useEffect, useState } from "react";
import { getRawToken } from "../api/client";

/**
 * HTML notes are contained, not sanitized: a sandboxed iframe (allow-scripts,
 * never allow-same-origin) pointed at the /raw route via a short-lived,
 * note-scoped token. The frame is an opaque origin — its scripts cannot read
 * the app's storage, call the API with our key, or touch the parent DOM.
 */
export function HtmlNote({ noteId, title }: { noteId: string; title: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSrc(null);
    setError(null);
    getRawToken(noteId)
      .then(({ token }) => {
        if (active) {
          setSrc(`/raw/${encodeURIComponent(noteId)}?token=${encodeURIComponent(token)}`);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [noteId]);

  if (error) {
    return <p className="p-8 text-sm text-red-700">Failed to load: {error}</p>;
  }
  if (!src) {
    return <p className="p-8 text-sm text-ink-500">Loading…</p>;
  }
  return (
    <iframe
      sandbox="allow-scripts"
      src={src}
      title={title}
      className="h-full w-full border-0 bg-white"
    />
  );
}
