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

/** What a line can sit inside: a quote, or a list item whose content starts this many columns past its parent's. */
type Container = 'quote' | number;

/** How a block ends: what a chip on the line after it has to stay inside, so a list stays one list and a quote one quote. */
interface BlockEnd {
  containers: readonly Container[];
  /** It runs on until a blank line, so a chip needs one before it, or the chip is in the block. */
  runsToBlankLine?: boolean;
}

interface ProtectedRange {
  start: number;
  /** Exclusive. */
  end: number;
  /** A fence, indented code or a raw HTML block: a chip after it needs a line of its own, or it stays inside. */
  block?: BlockEnd;
  /** One that never closes: nothing after it is outside it. */
  open?: boolean;
}

/** A fence line, whatever stands before it: what `blockRanges` reads, it reads with its containers taken off. */
const FENCE_LINE = /^[ \t]*(?:>[ \t]*|(?:[-*+]|\d{1,9}[.)])[ \t]+)*(?:`{3,}|~{3,})/;
const FENCE_OPEN = /^(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^(`{3,}|~{3,})[ \t]*$/;

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

const LIST_MARKER = /^(?:[-*+]|(\d{1,9})[.)])(?= |$)/;
const ATX_HEADING = /^#{1,6}(?: |$)/;
const THEMATIC_BREAK = /^(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;

function withoutTabs(line: string): string {
  if (!line.includes('\t')) return line;
  let out = '';
  for (const char of line) out += char === '\t' ? ' '.repeat(4 - (out.length % 4)) : char;
  return out;
}

function spacesAt(line: string, at: number): number {
  let count = 0;
  while (line[at + count] === ' ') count++;
  return count;
}

/**
 * How many of the open containers a line continues, and where its text starts inside them. A blank line continues a list
 * item, and no quote.
 */
function continueContainers(line: string, open: readonly Container[]): { matched: number; at: number } {
  let at = 0;
  let matched = 0;
  for (const container of open) {
    const indent = spacesAt(line, at);
    if (container === 'quote') {
      if (indent > 3 || line[at + indent] !== '>') break;
      at += indent + 1;
      if (line[at] === ' ') at++;
    } else if (at + indent >= line.length) {
      at = line.length;
    } else {
      if (indent < container) break;
      at += container;
    }
    matched++;
  }
  return { matched, at };
}

/** The quotes and list items a line opens from `from`. In a paragraph, an empty item or a list not starting at 1 is text. */
function openContainers(line: string, from: number, inParagraph: boolean): { opened: Container[]; at: number } {
  const opened: Container[] = [];
  let at = from;
  for (;;) {
    const indent = spacesAt(line, at);
    if (indent > 3) break;
    const rest = line.slice(at + indent);
    if (rest[0] === '>') {
      opened.push('quote');
      at += indent + 1;
      if (line[at] === ' ') at++;
      continue;
    }
    const marker = LIST_MARKER.exec(rest);
    if (!marker || THEMATIC_BREAK.test(rest)) break;
    const after = spacesAt(rest, marker[0].length);
    const empty = marker[0].length + after >= rest.length;
    const startsAtOne = marker[1] === undefined || Number(marker[1]) === 1;
    if (inParagraph && opened.length === 0 && (empty || !startsAtOne)) break;
    const pad = empty || after > 4 ? 1 : after;
    opened.push(indent + marker[0].length + pad);
    at = empty ? line.length : at + indent + marker[0].length + pad;
  }
  return { opened, at };
}

/**
 * The code blocks and raw HTML blocks of a text, each as far as its container holds it. Indented code needs that as well: a
 * list item's own continuation looks the same (`- a`, blank, four spaces), and so does a paragraph's next line.
 */
function blockRanges(text: string): ProtectedRange[] {
  const ranges: ProtectedRange[] = [];
  let open: Container[] = [];
  let inParagraph = false;
  let fence: { char: string; length: number; start: number } | null = null;
  let html: { start: number; end: RegExp | null; through: number } | null = null;
  let code: { start: number; through: number; containers: readonly Container[] } | null = null;
  let lineStart = 0;
  while (lineStart <= text.length) {
    const newline = text.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? text.length : newline;
    const line = withoutTabs(text.slice(lineStart, lineEnd));
    const { matched, at } = continueContainers(line, open);
    const blank = line.slice(at).trim() === '';

    // Indented code goes on through blank lines, and ends at its last line that holds code.
    if (code !== null && (matched < open.length || (!blank && spacesAt(line, at) < 4))) {
      ranges.push({ start: code.start, end: code.through, block: { containers: code.containers } });
      code = null;
    }
    // A line its container does not hold ends a block in that container, closed or not.
    if (matched < open.length && fence !== null) {
      ranges.push({ start: fence.start, end: lineStart - 1, block: { containers: open.slice(0, matched) } });
      fence = null;
    }
    if (matched < open.length && html !== null) {
      const block =
        html.end === null ? { containers: open, runsToBlankLine: true } : { containers: open.slice(0, matched) };
      ranges.push({ start: html.start, end: html.through, block });
      html = null;
    }

    if (code !== null) {
      if (!blank) code.through = lineEnd;
    } else if (fence !== null) {
      const indent = spacesAt(line, at);
      const close = indent <= 3 ? FENCE_CLOSE.exec(line.slice(at + indent)) : null;
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        ranges.push({ start: fence.start, end: lineEnd, block: { containers: open } });
        fence = null;
      }
    } else if (html !== null) {
      if (html.end === null ? blank : html.end.test(line)) {
        const block = { containers: open, runsToBlankLine: html.end === null };
        ranges.push({ start: html.start, end: html.end === null ? html.through : lineEnd, block });
        html = null;
      } else {
        html.through = lineEnd;
      }
    } else {
      const continued = matched === open.length;
      const { opened, at: inner } = openContainers(line, at, inParagraph && continued);
      const indent = spacesAt(line, inner);
      const body = line.slice(inner + indent);
      const opening = indent <= 3 ? FENCE_OPEN.exec(body) : null;
      // A backtick fence's info string holds no backtick: that line is inline code instead.
      const opensFence = opening !== null && (opening[1][0] !== '`' || !opening[2].includes('`'));
      const htmlBlock = indent <= 3 && !opensFence ? HTML_BLOCKS.find(block => block.opens.test(body)) : undefined;
      const lazy =
        !continued &&
        inParagraph &&
        opened.length === 0 &&
        body !== '' &&
        !opensFence &&
        !htmlBlock &&
        !ATX_HEADING.test(body) &&
        !THEMATIC_BREAK.test(body);
      if (!lazy) {
        open = [...open.slice(0, matched), ...opened];
        if (!continued || opened.length > 0) inParagraph = false;
        if (opensFence) {
          fence = { char: opening[1][0], length: opening[1].length, start: lineStart };
          inParagraph = false;
        } else if (htmlBlock) {
          inParagraph = false;
          if (htmlBlock.end?.test(line)) {
            ranges.push({ start: lineStart, end: lineEnd, block: { containers: open } });
          } else {
            html = { start: lineStart, end: htmlBlock.end, through: lineEnd };
          }
        } else if (body !== '' && indent >= 4 && !inParagraph) {
          code = { start: lineStart, through: lineEnd, containers: open };
        } else if (body === '' || (indent < 4 && (ATX_HEADING.test(body) || holdsNothing(body)))) {
          inParagraph = false;
        } else {
          inParagraph = true;
        }
      }
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }
  if (code !== null) ranges.push({ start: code.start, end: code.through, block: { containers: code.containers } });
  if (fence !== null) ranges.push({ start: fence.start, end: text.length, block: { containers: open }, open: true });
  if (html !== null) {
    ranges.push(
      html.end === null
        ? { start: html.start, end: html.through, block: { containers: open, runsToBlankLine: true } }
        : { start: html.start, end: text.length, block: { containers: open }, open: true },
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
 * thematic break, a setext underline, a link's reference definition, a quote's blank line.
 */
const HOLDS_NOTHING: readonly RegExp[] = [
  /^\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/,
  THEMATIC_BREAK,
  /^=+[ \t]*$/,
  /^\[[^\]]+\]:/,
  /^$/,
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

/** Whether a backslash escapes the character at `at`. */
function isEscaped(text: string, at: number): boolean {
  let backslashes = 0;
  while (text[at - backslashes - 1] === '\\') backslashes++;
  return backslashes % 2 === 1;
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
  if (line.endsWith('|') && !isEscaped(text, position - 1)) return backOverSpace(text, position - 1);
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
    if (BLANK_LINE_OF_QUOTE.test(above) || FENCE_LINE.test(above) || ONE_LINE_BLOCK.test(above)) return start;
    start = previous;
  }
  return start;
}

interface ChipPlace {
  position: number;
  /** After a block, on a line of its own. */
  block: BlockEnd | null;
}

/** A line of its own, with nothing holding it. */
const AT_TOP_LEVEL: BlockEnd = { containers: [] };

const QUOTE_LINE = /^[ \t]*>/;

/** A chip in front of what the first line opens would turn it into text. */
function opensABlock(text: string, ranges: readonly ProtectedRange[]): boolean {
  if (ranges[0]?.block && ranges[0].start === 0) return true;
  const line = text.slice(0, lineEndOf(text, 0));
  return LIST_ITEM_LINE.test(line) || ONE_LINE_BLOCK.test(line) || QUOTE_LINE.test(line) || holdsNothing(line);
}

/** What may close around a sentence's last mark: a quote, a bracket, emphasis. CJK closers are full-width. */
const SENTENCE_CLOSERS = new Set([
  '"',
  "'",
  '”',
  '’',
  '»',
  ')',
  ']',
  '}',
  '*',
  '_',
  '~',
  '\u300D',
  '\u300F',
  '\u3011',
  '\u3015',
  '\u3009',
  '\u300B',
  '\uFF09',
  '\uFF3D',
  '\uFF5D',
]);
/** What ends a sentence where text follows with a space: Latin and Cyrillic, Arabic and Urdu, Devanagari, Armenian. */
const SPACED_SENTENCE_MARKS = new Set(['.', '!', '?', '\u061F', '\u06D4', '\u0964', '\u0965', '\u0589']);
/** What ends a sentence in Chinese and Japanese, where the next one follows with no space: the ideographic and full-width marks. */
const UNSPACED_SENTENCE_MARKS = new Set(['\u3002', '\uFF61', '\uFF01', '\uFF1F']);
/** A full stop that ends a word and no sentence. */
const ABBREVIATION = /(?:^|[\s(])(?:e\.g|i\.e|vs)\.$/i;

/**
 * Past the sentence the mark at `at` ends and what closes around it, or -1 when it ends none. Text right after it means
 * no end, which is what a decimal, a version and a domain are ($1.00, v1.2.3, flamingo.run).
 */
function sentenceEndAt(text: string, at: number): number {
  const unspaced = UNSPACED_SENTENCE_MARKS.has(text[at]);
  if (!unspaced && !SPACED_SENTENCE_MARKS.has(text[at])) return -1;
  let end = at + 1;
  while (end < text.length && SENTENCE_CLOSERS.has(text[end])) end++;
  if (unspaced) return end;
  if (end < text.length && !/\s/.test(text[end])) return -1;
  return ABBREVIATION.test(text.slice(Math.max(0, at - 4), at + 1)) ? -1 : end;
}

/**
 * The end of the sentence a position is in, so a number reads at the end of what it backs and never before a comma (an
 * API citation ends where its block ends, which is often mid-sentence). Never past the line, so a table's row and a list's
 * item stay whole; never past a table's cell; and a line with no end takes the chip at its own end. Code and links are
 * stepped over: a mark inside one ends nothing, and one that crosses a line ends the walk where it opens.
 */
function endOfSentence(text: string, ranges: readonly ProtectedRange[], position: number): number {
  if (text[position - 1] === '|') return position;
  let back = position - 1;
  while (back > 0 && SENTENCE_CLOSERS.has(text[back])) back--;
  const here = sentenceEndAt(text, back);
  if (here >= position) return here;

  const lineEnd = lineEndOf(text, position);
  let at = position;
  let next = 0;
  while (at < lineEnd) {
    while (next < ranges.length && ranges[next].start < at) next++;
    const range = ranges[next];
    if (range?.start === at) {
      if (range.end > lineEnd) return backOverSpace(text, at);
      at = range.end;
      // Of everything stepped over, only a bare url can end in a mark, and its full stop is the sentence's.
      const end = sentenceEndAt(text, at - 1);
      if (end !== -1) return end;
    } else if (text[at] === '\\') {
      at += 2;
    } else if (text[at] === '|') {
      return backOverSpace(text, at);
    } else {
      const end = sentenceEndAt(text, at);
      if (end !== -1) return end;
      at++;
    }
  }
  return backOverSpace(text, lineEnd);
}

const LINE_MARKERS = /^[ \t]*(?:>[ \t]*|(?:[-*+]|\d{1,9}[.)])(?:[ \t]+|$))*/;

/** Back past a line's own quote and list markers: nothing is cited yet there, and a chip would open the line (a table's row). */
function beforeLineMarkers(text: string, position: number): number {
  let at = position;
  while (at > 0) {
    const start = lineStartOf(text, at);
    const markers = LINE_MARKERS.exec(text.slice(start, lineEndOf(text, at)))?.[0] ?? '';
    if (at - start > markers.length) return at;
    at = backOverSpace(text, start);
  }
  return at;
}

/** Where a citation's chip goes: never inside what its markdown would break. Null when no place in the text is safe. */
function chipPlace(text: string, ranges: readonly ProtectedRange[], endIndex: number): ChipPlace | null {
  const cited = beforeLineMarkers(text, backOverSpace(text, Math.min(endIndex, text.length)));
  if (cited === 0) return { position: 0, block: opensABlock(text, ranges) ? AT_TOP_LEVEL : null };
  let position = placeOnAHoldingLine(text, cited);
  if (position === null) return { position: lineEndOf(text, cited), block: AT_TOP_LEVEL };
  for (const range of ranges) {
    if (position <= range.start) break;
    if (range.open) return null;
    if (position < range.end) {
      position = range.end;
      if (range.block) return { position, block: range.block };
      break;
    }
    if (position === range.end && range.block) return { position, block: range.block };
  }
  const end = endOfSentence(text, ranges, position);
  return { position: beforeWhatEndsTheLine(text, pastClosingEmphasis(text, end)), block: null };
}

/**
 * Whether the line under a chip that closes a block needs a blank line between them: a line what holds the block does not
 * hold would join the chip's paragraph, a rule would make it a heading, and indented code would lose its indent. A sibling
 * list item needs none, and with one the list would turn loose.
 */
function needsABreakAfterTheChip(nextLine: string, containers: readonly Container[]): boolean {
  const line = withoutTabs(nextLine);
  if (BLANK_LINE_OF_QUOTE.test(line) || LIST_ITEM_LINE.test(line)) return false;
  const { matched, at } = continueContainers(line, containers);
  return matched < containers.length || spacesAt(line, at) >= 4 || holdsNothing(line);
}

/** A chip on a line of its own after a block. With nothing holding the block, blank lines around it. */
function chipLineAfter(text: string, position: number, block: BlockEnd, chips: string): string {
  const atTheEnd = position >= text.length;
  if (block.containers.length === 0) return `\n\n${chips}${atTheEnd ? '' : '\n'}`;
  const prefix = block.containers.map(container => (container === 'quote' ? '> ' : ' '.repeat(container))).join('');
  const before = block.runsToBlankLine ? `\n${prefix.trimEnd()}` : '';
  const nextLine = atTheEnd ? '' : text.slice(position + 1, lineEndOf(text, position + 1));
  return `${before}\n${prefix}${chips}${needsABreakAfterTheChip(nextLine, block.containers) ? '\n' : ''}`;
}

/** A chip stands against a Chinese or Japanese mark, the way the next sentence does. */
function spaceBeforeChip(text: string, position: number): string {
  let back = position - 1;
  while (back > 0 && SENTENCE_CLOSERS.has(text[back])) back--;
  return UNSPACED_SENTENCE_MARKS.has(text[back]) ? '' : ' ';
}

/**
 * The part's markdown with its citation chips in it, for drawing only: ` [n](#citation-n)` at the end of the sentence
 * each citation's `endIndex` is in, before trailing whitespace, moved past any code span, fence or link it would land in.
 * Each source once per paragraph, and a list item or a table row is a paragraph of its own.
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
  const inserts = new Map<number, { block: BlockEnd | null; numbers: number[] }>();
  for (const place of places) {
    const key = `${paragraphStartOf(text, place.position)}:${place.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const insert = inserts.get(place.position);
    if (insert) {
      if (!insert.numbers.includes(place.number)) insert.numbers.push(place.number);
      insert.block ??= place.block;
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
      out += chipLineAfter(text, position, insert.block, chips);
    } else {
      out += `${spaceBeforeChip(text, position)}${chips}`;
    }
    at = position;
  }
  return out + text.slice(at);
}
