import ReactMarkdown, { type Components } from "react-markdown";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import rehypeSanitize from "rehype-sanitize";
import {
  remarkDirectiveToComponent,
  sanitizeSchema,
} from "../markdown/directives";
import { Callout } from "./Callout";

// Custom elements produced by the directive plugin, mapped to components.
const components = {
  "note-callout": Callout,
} as Components;

/**
 * The markdown render path: parse -> directives -> sanitize -> app DOM.
 * Content stays data; rehype-sanitize strips scripts/handlers, and rich
 * blocks come only from the fixed directive vocabulary.
 */
export function MarkdownNote({ content }: { content: string }) {
  return (
    <article className="note-prose mx-auto max-w-3xl px-8 py-8">
      <ReactMarkdown
        remarkPlugins={[
          remarkFrontmatter,
          remarkGfm,
          remarkDirective,
          remarkDirectiveToComponent,
        ]}
        rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
