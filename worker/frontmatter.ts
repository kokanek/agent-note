import { parse } from "yaml";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/**
 * Extract the YAML frontmatter block from a markdown body. The file keeps its
 * frontmatter (the file is the source of truth); this just produces the
 * denormalized copy stored in D1 for the sidebar/index.
 */
export function parseFrontmatter(
  content: string,
): Record<string, unknown> | null {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) return null;
  try {
    const data: unknown = parse(match[1]);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
