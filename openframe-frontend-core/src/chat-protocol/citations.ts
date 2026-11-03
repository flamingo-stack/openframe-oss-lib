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
function citationHref(number: number): string {
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
  /** A fence or a raw HTML block: a chip after it needs a line of its own, or the block does not close. */
  block?: boolean;
  /** One that never closes: nothing after it is outside it. */
  open?: boolean;
}

const FENCE_OPEN = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})(.*)$/;

/** What may stand before a raw HTML block on its line: a quote's or a list item's marker. */
const HTML_LINE_START = String.raw`^[ \t]*(?:(?:>|[-*+]|\d{1,9}[.)])[ \t]+)*`;
/** CommonMark's list of the tags that open a block whatever follows them on the line. */
const HTML_BLOCK_NAMES =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|' +
  'fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|' +
  'menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|' +
  'track|ul';
/**
 * What opens a raw HTML block (CommonMark 4.6) and what ends it: a line matching `end`, or a blank line. An inline tag
 * that opens a paragraph (`<kbd>K</kbd> opens it.`) is none of these.
 */
const HTML_BLOCKS: ReadonlyArray<{ opens: RegExp; end: RegExp | null }> = [
  {
    opens: new RegExp(String.raw`${HTML_LINE_START}<(?:script|pre|style|textarea)(?:[\s>]|$)`, 'i'),
    end: /<\/(?:script|pre|style|textarea)>/i,
  },
  { opens: new RegExp(`${HTML_LINE_START}<!--`), end: /-->/ },
  { opens: new RegExp(String.raw`${HTML_LINE_START}<\?`), end: /\?>/ },
  { opens: new RegExp(String.raw`${HTML_LINE_START}<!\[CDATA\[`), end: /\]\]>/ },
  { opens: new RegExp(`${HTML_LINE_START}<![a-zA-Z]`), end: />/ },
  { opens: new RegExp(String.raw`${HTML_LINE_START}</?(?:${HTML_BLOCK_NAMES})(?:[\s/>]|$)`, 'i'), end: null },
  { opens: new RegExp(String.raw`${HTML_LINE_START}</?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?/?>[ \t]*$`), end: null },
];

/** The fenced code blocks and raw HTML blocks of a text. */
function blockRanges(text: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let fence: { char: string; length: number; start: number } | null = null;
  let html: { start: number; end: RegExp | null; through: number } | null = null;
  let lineStart = 0;
  while (lineStart <= text.length) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = text.slice(lineStart, lineEnd);
    if (fence !== null) {
      const match = FENCE_OPEN.exec(line);
      if (match && match[1][0] === fence.char && match[1].length >= fence.length && match[2].trim() === '') {
        ranges.push({ start: fence.start, end: lineEnd, block: true });
        fence = null;
      }
    } else {
      const match = html === null ? FENCE_OPEN.exec(line) : null;
      // A backtick fence's info string holds no backtick: that line is inline code instead.
      if (match && (match[1][0] !== '`' || !match[2].includes('`'))) {
        fence = { char: match[1][0], length: match[1].length, start: lineStart };
      } else {
        if (html === null) {
          const opened = HTML_BLOCKS.find(block => block.opens.test(line));
          if (opened) html = { start: lineStart, end: opened.end, through: lineEnd };
        }
        if (html !== null) {
          if (html.end === null ? line.trim() === '' : html.end.test(line)) {
            ranges.push({ start: html.start, end: html.end === null ? html.through : lineEnd, block: true });
            html = null;
          } else {
            html.through = lineEnd;
          }
        }
      }
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }
  if (fence !== null) ranges.push({ start: fence.start, end: text.length, block: true, open: true });
  if (html !== null) {
    ranges.push(
      html.end === null
        ? { start: html.start, end: html.through, block: true }
        : { start: html.start, end: text.length, block: true, open: true },
    );
  }
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
  const ranges: ProtectedRange[] = [];
  let at = 0;
  for (const block of blockRanges(text)) {
    ranges.push(...inlineRanges(text, at, block.start), block);
    at = block.end;
  }
  ranges.push(...inlineRanges(text, at, text.length));
  return ranges;
}

/**
 * Lines the reader sees no text in, each of which stops being what it is with a chip on it: a table's delimiter row, a
 * thematic break, a setext underline, a link's reference definition.
 */
const HOLDS_NOTHING: readonly RegExp[] = [
  /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
  /^(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/,
  /^=+[ \t]*$/,
  /^\[[^\]]+\]:/,
];
const LINE_INDENT = /^[ \t]*(?:>[ \t]*)*/;
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

function holdsNothing(line: string): boolean {
  const body = line.replace(LINE_INDENT, '');
  return HOLDS_NOTHING.some(pattern => pattern.test(body));
}

/** The nearest place at or above `position` on a line a chip can sit on, or null when every line up there holds nothing. */
function placeOnAHoldingLine(text: string, position: number): number | null {
  let at = position;
  while (at > 0) {
    const start = lineStartOf(text, at);
    if (!holdsNothing(text.slice(start, lineEndOf(text, at)))) return at;
    at = backOverSpace(text, start);
  }
  return null;
}

const CLOSING_HEADING_HASHES = /^[ \t]*(?:>[ \t]*)*#{1,6}[ \t].*?([ \t]+#+)$/;
const TRAILING_BACKSLASHES = /\\+$/;

/**
 * What has to stay last on its line stays last: past a table row's closing pipe a chip is an extra cell, which a table
 * does not draw; past a heading's closing hashes they are text; past a backslash it is no hard break.
 */
function beforeWhatEndsTheLine(text: string, position: number): number {
  if (text.slice(position, lineEndOf(text, position)).trim() !== '') return position;
  const line = text.slice(lineStartOf(text, position), position);
  if (line.trimStart().startsWith('|') && line.endsWith('|')) return backOverSpace(text, position - 1);
  const hashes = CLOSING_HEADING_HASHES.exec(line);
  if (hashes) return position - hashes[1].length;
  const backslashes = TRAILING_BACKSLASHES.exec(line);
  return backslashes && backslashes[0].length % 2 === 1 ? position - 1 : position;
}

const LIST_ITEM_LINE = /^[ \t]*(?:>[ \t]*)*(?:[-*+][ \t]|\d{1,9}[.)][ \t])/;
/** A heading or a table row (a row needs no leading pipe): one line, and it ends there. */
const ONE_LINE_BLOCK = /^[ \t]*(?:>[ \t]*)*#{1,6}[ \t]|\|/;
const BLANK_LINE_OF_QUOTE = /^[ \t>]*$/;

/**
 * Where the paragraph a position is in starts: at the blank line, fence or one-line block above it, so a soft-wrapped line
 * is the same paragraph. A list item is its own, and its wrapped lines belong to it.
 */
function paragraphStartOf(text: string, position: number): number {
  let start = lineStartOf(text, position);
  while (start > 0) {
    const line = text.slice(start, lineEndOf(text, start));
    if (LIST_ITEM_LINE.test(line) || ONE_LINE_BLOCK.test(line)) return start;
    const previous = lineStartOf(text, start - 1);
    const above = text.slice(previous, start - 1);
    if (BLANK_LINE_OF_QUOTE.test(above) || FENCE_OPEN.test(above) || ONE_LINE_BLOCK.test(above)) return start;
    start = previous;
  }
  return start;
}

interface ChipPlace {
  position: number;
  /** After a fence, on a line of its own. */
  block: boolean;
}

const QUOTE_LINE = /^[ \t]*>/;
const INDENTED_CODE_LINE = /^(?: {4}|\t)/;

/** A chip in front of what the first line opens would turn it into text. */
function opensABlock(text: string, ranges: readonly ProtectedRange[]): boolean {
  if (ranges[0]?.block && ranges[0].start === 0) return true;
  const line = text.slice(0, lineEndOf(text, 0));
  return (
    LIST_ITEM_LINE.test(line) ||
    ONE_LINE_BLOCK.test(line) ||
    QUOTE_LINE.test(line) ||
    INDENTED_CODE_LINE.test(line) ||
    holdsNothing(line)
  );
}

/** Where a citation's chip goes: never inside what its markdown would break. Null when no place in the text is safe. */
function chipPlace(text: string, ranges: readonly ProtectedRange[], endIndex: number): ChipPlace | null {
  const cited = backOverSpace(text, Math.min(endIndex, text.length));
  if (cited === 0) return { position: 0, block: opensABlock(text, ranges) };
  let position = placeOnAHoldingLine(text, cited);
  if (position === null) return { position: lineEndOf(text, cited), block: true };
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
  return { position: beforeWhatEndsTheLine(text, pastClosingEmphasis(text, position)), block: false };
}

/**
 * The part's markdown with its citation chips in it, for drawing only: ` [n](#citation-n)` at each citation's `endIndex`,
 * before trailing whitespace, moved past any code span, fence or link it would land in. Each source once per paragraph,
 * and a list item or a table row is a paragraph of its own.
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
    const key = `${paragraphStartOf(text, place.position)}:${place.source}`;
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
    if (position === 0) {
      // Nothing before it: what separates it goes after it.
      out += insert.block ? `${chips}\n\n` : `${chips} `;
    } else if (insert.block) {
      out += `\n\n${chips}`;
      if (position < text.length) out += '\n';
    } else {
      out += ` ${chips}`;
    }
    at = position;
  }
  return out + text.slice(at);
}
