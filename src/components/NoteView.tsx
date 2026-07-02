import type { Note } from "../api/client";
import { MarkdownNote } from "./MarkdownNote";
import { HtmlNote } from "./HtmlNote";

/**
 * The render router — the trust boundary. `format` decides the path:
 * md is rendered inline as sanitized data, html is contained in a sandbox.
 */
export function NoteView({ note }: { note: Note }) {
  if (note.format === "html") {
    return <HtmlNote noteId={note.id} title={note.title} />;
  }
  return <MarkdownNote content={note.content} />;
}
