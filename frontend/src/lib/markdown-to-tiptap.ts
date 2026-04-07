/**
 * Markdown → TipTap JSONContent converter
 * Converts AI-generated markdown text into proper TipTap editor JSON.
 */

import type { JSONContent } from "@tiptap/react";

/* ------------------------------------------------------------------ */
/* Inline text parsing (bold, italic, bold+italic)                     */
/* ------------------------------------------------------------------ */

interface TextNode {
  type: "text";
  text: string;
  marks?: Array<{ type: string }>;
}

function parseInlineMarks(text: string): TextNode[] {
  if (!text || !text.trim()) return [{ type: "text", text: text || " " }];

  const nodes: TextNode[] = [];
  // Match ***bold+italic***, **bold**, *italic*
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // ***bold+italic***
      nodes.push({
        type: "text",
        text: match[2],
        marks: [{ type: "bold" }, { type: "italic" }],
      });
    } else if (match[3]) {
      // **bold**
      nodes.push({
        type: "text",
        text: match[3],
        marks: [{ type: "bold" }],
      });
    } else if (match[4]) {
      // *italic*
      nodes.push({
        type: "text",
        text: match[4],
        marks: [{ type: "italic" }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  if (nodes.length === 0) {
    nodes.push({ type: "text", text });
  }

  return nodes;
}

/* ------------------------------------------------------------------ */
/* Block-level parsing                                                 */
/* ------------------------------------------------------------------ */

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Convert a markdown string into TipTap JSONContent.
 */
export function markdownToTipTapJSON(markdown: string): JSONContent {
  const lines = markdown.split("\n");
  const content: JSONContent[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line → skip
    if (!trimmed) {
      i++;
      continue;
    }

    // Heading: # ## ###
    if (/^#{1,3}\s/.test(trimmed)) {
      const level = (trimmed.match(/^(#{1,3})/)?.[1].length || 1) as 1 | 2 | 3;
      const text = trimmed.replace(/^#{1,3}\s+/, "");
      content.push({
        type: "heading",
        attrs: { level },
        content: parseInlineMarks(text),
      });
      i++;
      continue;
    }

    // Horizontal rule: --- or *** or ___
    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Table: starts with |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableRows: string[][] = [];
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (!tl.startsWith("|") || !tl.endsWith("|")) break;
        if (isTableSeparator(tl)) {
          i++;
          continue;
        }
        tableRows.push(parseTableRow(tl));
        i++;
      }

      if (tableRows.length > 0) {
        const headerCells = tableRows[0];
        const bodyRows = tableRows.slice(1);

        const tableNode: JSONContent = {
          type: "table",
          content: [
            // Header row
            {
              type: "tableRow",
              content: headerCells.map((cell) => ({
                type: "tableHeader",
                content: [
                  {
                    type: "paragraph",
                    content: parseInlineMarks(cell),
                  },
                ],
              })),
            },
            // Body rows
            ...bodyRows.map((row) => ({
              type: "tableRow",
              content: row.map((cell) => ({
                type: "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: parseInlineMarks(cell),
                  },
                ],
              })),
            })),
          ],
        };
        content.push(tableNode);
      }
      continue;
    }

    // Bullet list: - or * (collect consecutive)
    if (/^[-*]\s/.test(trimmed)) {
      const items: JSONContent[] = [];
      while (i < lines.length) {
        const bl = lines[i].trim();
        if (!bl || !/^[-*]\s/.test(bl)) break;
        const text = bl.replace(/^[-*]\s+/, "");
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInlineMarks(text),
            },
          ],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list: 1. 2. etc (collect consecutive)
    if (/^\d+\.\s/.test(trimmed)) {
      const items: JSONContent[] = [];
      while (i < lines.length) {
        const ol = lines[i].trim();
        if (!ol || !/^\d+\.\s/.test(ol)) break;
        const text = ol.replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: parseInlineMarks(text),
            },
          ],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // Blockquote: >
    if (trimmed.startsWith("> ")) {
      const quoteContent: JSONContent[] = [];
      while (i < lines.length) {
        const ql = lines[i].trim();
        if (!ql.startsWith("> ")) break;
        const text = ql.replace(/^>\s+/, "");
        quoteContent.push({
          type: "paragraph",
          content: parseInlineMarks(text),
        });
        i++;
      }
      content.push({ type: "blockquote", content: quoteContent });
      continue;
    }

    // Regular paragraph
    content.push({
      type: "paragraph",
      content: parseInlineMarks(trimmed),
    });
    i++;
  }

  return { type: "doc", content };
}
