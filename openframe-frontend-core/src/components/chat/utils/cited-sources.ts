import type { ChatSource } from '../types/message.types';

/** How many retrieved sources to show when the answer cited none of them. */
export const FALLBACK_TOP_RETRIEVED = 3;

export interface CitedSources {
  /** Sources the answer referenced, in the order the answer first referenced
   *  them — NOT in `index` order. */
  cited: ChatSource[];
  /** Everything retrieved but not referenced, in the order supplied. */
  uncited: ChatSource[];
}

/** `[1]`, `[12]` — a citation marker in the answer body. */
const CITATION = /\[(\d+)\]/g;

/** Fenced blocks and inline code spans. */
const CODE = /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g;

/**
 * Blank out code before looking for citations.
 *
 * `$items[1]`, `argv[1]`, `matrix[0][1]` — array indexing is not a citation,
 * and this assistant answers with scripts constantly. Left in, a snippet marks
 * a source as cited that the prose never mentions, and worse, seeds the reading
 * order from a position inside a code block.
 *
 * Replaced with spaces rather than removed so nothing outside the block shifts
 * — only whether a marker is inside one is being decided here.
 */
function withoutCode(content: string): string {
  return content.replace(CODE, block => ' '.repeat(block.length));
}

/**
 * Split an answer's sources into the ones it cited and the ones it did not.
 *
 * Reading order, not numeric order: the strip is a legend for the sentences
 * above it, so the chip for the citation the reader meets first comes first,
 * even when the model numbered it `[3]`. A number cited twice is placed once,
 * at its first mention.
 *
 * `content` is the flat answer text. A segmented message has to be flattened by
 * the caller — citation markers live in text segments, and this function
 * deliberately does not know what a segment is.
 */
export function splitCitedSources(sources: ChatSource[] | undefined, content: string): CitedSources {
  if (!sources || sources.length === 0) return { cited: [], uncited: [] };

  const firstMentionAt = new Map<number, number>();
  for (const match of withoutCode(content).matchAll(CITATION)) {
    const index = Number.parseInt(match[1], 10);
    if (!firstMentionAt.has(index)) firstMentionAt.set(index, firstMentionAt.size);
  }

  const cited = sources
    .filter(source => firstMentionAt.has(source.index))
    .sort((a, b) => (firstMentionAt.get(a.index) ?? 0) - (firstMentionAt.get(b.index) ?? 0));
  const uncited = sources.filter(source => !firstMentionAt.has(source.index));
  return { cited, uncited };
}
