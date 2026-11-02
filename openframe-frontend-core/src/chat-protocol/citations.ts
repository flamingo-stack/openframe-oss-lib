/**
 * A message's citations as the reader sees them: the numbers, and the chips in the text.
 *
 * Nothing here is stored. A stored text part holds its citations as offsets (`./chat-message`); a number is derived from
 * reading order every time, and a chip is drawn into a render-only copy of the markdown. Copying an answer uses
 * `textOfParts`, which has no chips in it.
 *
 * A chip is an ordinary markdown link with a fragment (`[3](#citation-3)`): it needs no sanitizer or `urlTransform`
 * change, which a scheme of its own would.
 *
 * Server-safe: no React, no browser APIs.
 */

import type { ChatCitation, ChatPart, ChatTextPart } from './chat-message';

const CITATION_HREF_PREFIX = '#citation-';

/** A chip's href. */
export function citationHref(number: number): string {
  return `${CITATION_HREF_PREFIX}${number}`;
}

/** The number a chip's href names, or null when it is not a chip's. */
export function parseCitationHref(href: unknown): number | null {
  if (typeof href !== 'string' || !href.startsWith(CITATION_HREF_PREFIX)) return null;
  const digits = href.slice(CITATION_HREF_PREFIX.length);
  return /^[1-9]\d*$/.test(digits) ? Number(digits) : null;
}

/** Where a citation sits in reading order: a citation with no `endIndex` sits at the end of its part. */
function positionOf(citation: ChatCitation, part: ChatTextPart): number {
  return citation.endIndex ?? part.text.length;
}

/**
 * Each cited source's number: 1-based, in reading order, one number per source (a collection is a source like any
 * other). A record that is only linked in the text has no number: a number exists only for a citation.
 */
export function citationNumbers(parts: readonly ChatPart[]): ReadonlyMap<string, number> {
  const numbers = new Map<string, number>();
  for (const part of parts) {
    if (part.type !== 'text' || !part.citations) continue;
    const ordered = [...part.citations].sort((a, b) => positionOf(a, part) - positionOf(b, part));
    for (const citation of ordered) {
      if (!numbers.has(citation.source.id)) numbers.set(citation.source.id, numbers.size + 1);
    }
  }
  return numbers;
}

// =============================================================================
// Where a chip can go
// =============================================================================

interface ProtectedRange {
  start: number;
  /** Exclusive. */
  end: number;
  /** A fence: a chip after it needs a line of its own, or the fence does not close. */
  block?: boolean;
  /** A fence that never closes: nothing after it is outside it. */
  open?: boolean;
}

const FENCE_OPEN = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})(.*)$/;

/** The fenced code blocks of a text. */
function fenceRanges(text: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let open: { char: string; length: number; start: number } | null = null;
  let lineStart = 0;
  while (lineStart <= text.length) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = text.slice(lineStart, lineEnd);
    const match = FENCE_OPEN.exec(line);
    if (match) {
      const char = match[1][0];
      if (open === null) {
        // A backtick fence's info string holds no backtick: that line is inline code instead.
        if (char !== '`' || !match[2].includes('`')) open = { char, length: match[1].length, start: lineStart };
      } else if (char === open.char && match[1].length >= open.length && match[2].trim() === '') {
        ranges.push({ start: open.start, end: lineEnd, block: true });
        open = null;
      }
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }
  if (open !== null) ranges.push({ start: open.start, end: text.length, block: true, open: true });
  return ranges;
}

const AUTOLINK_OR_TAG = /<[^\s<>][^<>\n]*>/y;
const BARE_URL = /https?:\/\/[^\s<>]+/y;
const BLANK_LINE = /\n[ \t]*\n/;
const BLANK_LINE_HERE = /^\n[ \t]*\n/;

/**
 * Where the code span opened by the run of `run` backticks before `from` closes, or -1 when nothing closes it before a
 * blank line: the closing run has exactly that length.
 */
export function closingBacktickRun(text: string, from: number, run: number): number {
  const fence = '`'.repeat(run);
  let close = text.indexOf(fence, from);
  while (close !== -1 && text[close + run] === '`') {
    let skip = close;
    while (text[skip] === '`') skip++;
    close = text.indexOf(fence, skip);
  }
  return close !== -1 && !BLANK_LINE.test(text.slice(from, close)) ? close : -1;
}

/** Where the matching `close` of the `open` at `at` is, or -1. Stops at a blank line: a span never crosses one. */
function matchingBracket(text: string, at: number, end: number, open: string, close: string): number {
  let depth = 0;
  for (let i = at; i < end; i++) {
    const char = text[i];
    if (char === '\\') {
      i++;
    } else if (char === '\n' && BLANK_LINE_HERE.test(text.slice(i, i + 80))) {
      return -1;
    } else if (char === open) {
      depth++;
    } else if (char === close && --depth === 0) {
      return i;
    }
  }
  return -1;
}

/** The inline code, links and autolinks between `from` and `to`. */
function inlineRanges(text: string, from: number, to: number): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let i = from;
  while (i < to) {
    const char = text[i];
    if (char === '\\') {
      i += 2;
    } else if (char === '`') {
      let run = 1;
      while (text[i + run] === '`') run++;
      const close = closingBacktickRun(text, i + run, run);
      if (close !== -1 && close < to) {
        ranges.push({ start: i, end: close + run });
        i = close + run;
      } else {
        i += run;
      }
    } else if (char === '[' || (char === '!' && text[i + 1] === '[')) {
      const open = char === '[' ? i : i + 1;
      const labelEnd = matchingBracket(text, open, to, '[', ']');
      const next = labelEnd === -1 ? '' : text[labelEnd + 1];
      const destinationEnd =
        next === '('
          ? matchingBracket(text, labelEnd + 1, to, '(', ')')
          : next === '['
            ? matchingBracket(text, labelEnd + 1, to, '[', ']')
            : -1;
      if (destinationEnd !== -1) {
        ranges.push({ start: i, end: destinationEnd + 1 });
        i = destinationEnd + 1;
      } else {
        i = open + 1;
      }
    } else {
      const pattern = char === '<' ? AUTOLINK_OR_TAG : char === 'h' ? BARE_URL : null;
      if (pattern) {
        pattern.lastIndex = i;
        const match = pattern.exec(text);
        if (match && i + match[0].length <= to) {
          ranges.push({ start: i, end: i + match[0].length });
          i += match[0].length;
          continue;
        }
      }
      i++;
    }
  }
  return ranges;
}

/** Everything a chip may not land inside, in text order. */
function protectedRanges(text: string): ProtectedRange[] {
  const fences = fenceRanges(text);
  const ranges: ProtectedRange[] = [];
  let at = 0;
  for (const fence of fences) {
    ranges.push(...inlineRanges(text, at, fence.start), fence);
    at = fence.end;
  }
  ranges.push(...inlineRanges(text, at, text.length));
  return ranges;
}

const TABLE_DELIMITER_ROW = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;
const EMPHASIS_CHARS = new Set(['*', '_', '~']);

function lineStartOf(text: string, position: number): number {
  return text.lastIndexOf('\n', position - 1) + 1;
}

function lineEndOf(text: string, position: number): number {
  const newline = text.indexOf('\n', position);
  return newline === -1 ? text.length : newline;
}

function backOverSpace(text: string, position: number): number {
  let at = position;
  while (at > 0 && /\s/.test(text[at - 1])) at--;
  return at;
}

/** Past an emphasis run the position is inside or that closes right here: `**bold**|`, never `**bold|**` or `*|*`. */
function pastClosingEmphasis(text: string, position: number): number {
  if (!EMPHASIS_CHARS.has(text[position]) || position === 0 || /\s/.test(text[position - 1])) return position;
  let end = position;
  while (end < text.length && text[end] === text[position]) end++;
  const after = text[end];
  return after === undefined || /[\s.,;:!?)\]]/.test(after) ? end : position;
}

/** A chip in a table stays in its cell: text past a row's closing pipe is an extra cell, which a table does not draw. */
function insideTableCell(text: string, position: number): number {
  let at = position;
  const lineStart = lineStartOf(text, at);
  const lineEnd = lineEndOf(text, at);
  // A table's delimiter row, or a thematic break, holds nothing: the line before it does.
  if (lineStart > 0 && TABLE_DELIMITER_ROW.test(text.slice(lineStart, lineEnd))) at = backOverSpace(text, lineStart);
  const start = lineStartOf(text, at);
  const line = text.slice(start, lineEndOf(text, at)).trimStart();
  if (line.startsWith('|') && text[at - 1] === '|' && text.slice(at, lineEndOf(text, at)).trim() === '') {
    at = backOverSpace(text, at - 1);
  }
  return at;
}

interface ChipPlace {
  position: number;
  /** After a fence, on a line of its own. */
  block: boolean;
}

/** Where a citation's chip goes: never inside what its markdown would break. Null when no place in the text is safe. */
function chipPlace(text: string, ranges: readonly ProtectedRange[], endIndex: number): ChipPlace | null {
  let position = backOverSpace(text, Math.min(endIndex, text.length));
  for (const range of ranges) {
    if (position <= range.start) break;
    if (range.open) return null;
    if (position < range.end) {
      position = range.end;
      if (range.block) return { position, block: true };
      break;
    }
    if (position === range.end && range.block) return { position, block: true };
  }
  return { position: insideTableCell(text, pastClosingEmphasis(text, position)), block: false };
}

/**
 * The part's markdown with its citation chips in it, for drawing only: ` [n](#citation-n)` at each citation's `endIndex`,
 * before trailing whitespace, moved past any code span, fence or link it would land in. Each source once per line: a
 * paragraph is a line here, because a list item or a table row is its own.
 */
export function textWithCitationChips(part: ChatTextPart, numbers: ReadonlyMap<string, number>): string {
  if (!part.citations || part.citations.length === 0) return part.text;
  const { text } = part;
  const ranges = protectedRanges(text);

  const places = part.citations
    .map(citation => {
      const number = numbers.get(citation.source.id);
      const place = number === undefined ? null : chipPlace(text, ranges, positionOf(citation, part));
      return place && number !== undefined ? { ...place, number, source: citation.source.id } : null;
    })
    .filter((place): place is ChipPlace & { number: number; source: string } => place !== null)
    .sort((a, b) => a.position - b.position || a.number - b.number);

  const seen = new Set<string>();
  const inserts = new Map<number, { block: boolean; numbers: number[] }>();
  for (const place of places) {
    const key = `${lineStartOf(text, place.position)}:${place.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const insert = inserts.get(place.position);
    if (insert) {
      if (!insert.numbers.includes(place.number)) insert.numbers.push(place.number);
      insert.block ||= place.block;
    } else {
      inserts.set(place.position, { block: place.block, numbers: [place.number] });
    }
  }

  let out = '';
  let at = 0;
  for (const [position, insert] of [...inserts].sort(([a], [b]) => a - b)) {
    out += text.slice(at, position);
    const chips = insert.numbers.map(n => `[${n}](${citationHref(n)})`).join(' ');
    if (insert.block) {
      out += `\n\n${chips}`;
      if (position < text.length) out += '\n';
    } else {
      out += ` ${chips}`;
    }
    at = position;
  }
  return out + text.slice(at);
}
