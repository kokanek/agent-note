import { visit } from "unist-util-visit";
import { defaultSchema } from "rehype-sanitize";
import type { Root } from "mdast";

// The note can only invoke this fixed vocabulary of rich blocks.
export const DIRECTIVE_TAGS: Record<string, string> = {
  callout: "note-callout",
};

interface DirectiveNode {
  type: string;
  name: string;
  attributes?: Record<string, string | null | undefined>;
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

/**
 * Map remark-directive nodes (:::callout{type=warning} ... :::) onto custom
 * hast element names that react-markdown resolves to React components.
 * Unknown directive names degrade to a plain div so their content still shows.
 */
export function remarkDirectiveToComponent() {
  return (tree: Root) => {
    visit(tree, (node) => {
      const n = node as unknown as DirectiveNode;
      if (
        n.type === "containerDirective" ||
        n.type === "leafDirective" ||
        n.type === "textDirective"
      ) {
        const data = n.data ?? (n.data = {});
        data.hName = DIRECTIVE_TAGS[n.name] ?? "div";
        data.hProperties = { ...n.attributes };
      }
    });
  };
}

// defaultSchema strips <script>, on* handlers, javascript: URLs, etc.
// We extend it only with the directive-produced elements above.
export const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...Object.values(DIRECTIVE_TAGS)],
  attributes: {
    ...defaultSchema.attributes,
    "note-callout": ["type", "title"],
  },
};
