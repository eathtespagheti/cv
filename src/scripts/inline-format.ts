//
//  inline-format.ts
//  CV Hub — shared text-formatting helper for content blocks
//
//  Created by Alexander Gusarov on 27.08.2026.
//  @spartan121
//
//  Case-study body/paragraph text is authored as a small Markdown subset:
//  `backtick` code spans, **bold** and *italic* spans, and `- ` bullet lists.
//  These helpers turn that subset into plain data structures the templates map
//  to real elements — no markdown engine, no set:html — so Astro keeps
//  auto-escaping every string and content data can never inject markup.
//
//    parseInline(text)  → InlineSegment[]  (one paragraph/line's inline spans)
//    parseBodyBlocks(t) → BodyBlock[]      (paragraphs and bullet lists)
//
//  Inline parsing is deliberately flat: no nesting (`**bold with `code`**`).
//  Nothing in the content uses it, and a flat tokenizer can't mis-nest.
//

export type InlineSegmentType = 'text' | 'code' | 'bold' | 'italic';

export type InlineSegment = { type: InlineSegmentType; text: string };

export type BodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

// Ordered so `**bold**` wins over `*italic*`.
const INLINE_TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

function classify(part: string): InlineSegment {
  if (part.length >= 3 && part.startsWith('`') && part.endsWith('`')) {
    return { type: 'code', text: part.slice(1, -1) };
  }
  if (part.length >= 5 && part.startsWith('**') && part.endsWith('**')) {
    return { type: 'bold', text: part.slice(2, -2) };
  }
  if (part.length >= 3 && part.startsWith('*') && part.endsWith('*')) {
    return { type: 'italic', text: part.slice(1, -1) };
  }
  return { type: 'text', text: part };
}

export function parseInline(input: unknown): InlineSegment[] {
  const s = String(input ?? '');
  if (!s) return [];
  return s
    .split(INLINE_TOKEN)
    .filter((part) => part !== '')
    .map(classify);
}

const BULLET = /^\s*-\s+(.*)$/;

export function parseBodyBlocks(input: unknown): BodyBlock[] {
  const s = String(input ?? '').replace(/\r\n?/g, '\n');
  if (!s.trim()) return [];

  const blocks: BodyBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list && list.length > 0) blocks.push({ type: 'list', items: list });
    list = null;
  };

  for (const line of s.split('\n')) {
    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      (list ??= []).push(bullet[1].trim());
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}
