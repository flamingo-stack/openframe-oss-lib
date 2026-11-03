/**
 * TODO(CU-17tkuw61kfy): everything older backends and older rows say, read into the standard shapes. Deleted whole at
 * the cleanup, once the hub, the tenant and every stored row speak the new names. Only `./message-decoder` reads it.
 *
 * What it reads:
 *   - the old hub's byte frames (`[JSON]\0 … \x1E <text> [\x1D JSON \0] … \x1F [JSON]`), as chunks;
 *   - an old stored row (`content`, `sources`, parts holding `RECORD_CARDS`), as parts;
 *   - the old source names (`name`, `externalUrl`, `documentType` + `id`, `items`, `videos`, `cards`, `GUIDE`);
 *   - the old Mingo shapes: `approval_request_id`, an approval row with no tool list, a tool row with no run id;
 *   - `[card://t:i]`, `@marker:id` and `[N]` in a text, as cards, record links and citations. A text arrives in slices,
 *     so an unfinished token at the tail is held until the next slice says what it was;
 *   - the old `/api/docs/search` names.
 *
 * Self-contained on purpose: it shares nothing with the modules that wrote those shapes, so they can go first.
 *
 * Server-safe: no React, no browser APIs beyond TextDecoder.
 */

import { getPlatformCanonicalUrl } from '../platform-domains';
import { applyChunk, createWireState } from './apply-chunk';
import {
  citationSourceOfPart,
  storablePartsOf,
  type ChatCitation,
  type ChatCitationSource,
  type ChatMessageMetadata,
  type ChatPart,
  type ChatSourcePart,
  type ChatUsage,
} from './chat-message';
import { CITATION_CHIP_FOLLOW, CITATION_CHIP_RUN } from './citation-chip';
import { closingBacktickRun } from './citations';
import { CHAT_PROGRESS_STAGES, type ChatProgressStage } from './progress';
import { collectionHref, normalizeRecordUris, parseRecordHref, recordHref, recordLinkMarkdown } from './record-link';
import { finishReasonOfStop, type UiChunk } from './ui-chunks';
import { isRecord } from './wire-narrow';

// =============================================================================
// Sources
// =============================================================================

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

const OLD_REF = /^\[card:\/\/([a-zA-Z0-9_-]+):([^\]\r\n)]+)\]$/;

/** The record an old row's link or `[card://…]` ref names, when it has one. */
function oldLinkedRecord(row: Record<string, unknown>): { type: string; id: string } | null {
  const link = parseRecordHref(row.recordLink);
  if (link) return link;
  const ref = typeof row.ref === 'string' ? OLD_REF.exec(row.ref) : null;
  return ref ? { type: ref[1], id: ref[2] } : null;
}

/** The record an old row names, in the order the old readers trusted it. A markdown doc is keyed by its path, whatever else names it. */
function oldRecordUri(row: Record<string, unknown>): string | null {
  const linked = oldLinkedRecord(row);
  const type = linked?.type ?? text(row.documentType) ?? text(row.entityType);
  if (!type) return null;
  const path = text(row.path);
  if (type === 'markdown' && path) return recordHref(type, path);
  const key = linked?.id ?? text(row.entityId) ?? text(row.id) ?? path;
  return key ? recordHref(type, key) : null;
}

/**
 * An old row's address. A relative one with a named owner goes on that platform's canonical origin, because its
 * `targetPlatform` is not carried any more and only the url can say it. One with no owner stays relative: the host's
 * composer resolves it, as it does today.
 */
function oldUrl(row: Record<string, unknown>): string | undefined {
  const url = text(row.externalUrl) ?? text(row.url);
  if (!url) return undefined;
  const owner = text(row.targetPlatform);
  return url.startsWith('/') && owner ? `${getPlatformCanonicalUrl(owner)}${url}` : url;
}

function oldSourcePart(row: Record<string, unknown>): ChatSourcePart | null {
  const sourceId = oldRecordUri(row);
  if (!sourceId) return null;
  const title = text(row.name) ?? text(row.title);
  const url = oldUrl(row);
  if (url) return { type: 'source-url', sourceId, url, ...(title ? { title } : {}) };
  const filename = text(row.path);
  return {
    type: 'source-document',
    sourceId,
    mediaType: 'text/plain',
    title: title ?? parseRecordHref(sourceId)?.id ?? sourceId,
    ...(filename ? { filename } : {}),
  };
}

interface NumberedSource {
  source: ChatCitationSource;
  /** The source part a citation of a grouped row adds: the rows it groups are parts already, its collection is not. */
  part?: ChatSourcePart;
}

/** What one turn's old source rows say: their parts, and what each `[N]` of its text names. */
interface OldSourceIndex {
  /** The parts of these rows, recording their numbers. The first row to claim a number keeps it. */
  register(rows: unknown): ChatSourcePart[];
  /** Parts that reached the message another way: what they call a record names its tokens too. */
  remember(parts: readonly ChatSourcePart[]): void;
  numbered(number: number): NumberedSource | undefined;
  /** The title a source part gave this record. */
  labelOf(uri: string): string | undefined;
}

export function createOldSourceIndex(): OldSourceIndex {
  const numbers = new Map<number, NumberedSource>();
  const labels = new Map<string, string>();

  function rememberLabel(part: ChatSourcePart): void {
    if (part.title && !labels.has(part.sourceId)) labels.set(part.sourceId, part.title);
  }

  return {
    register(rows) {
      if (!Array.isArray(rows)) return [];
      const parts: ChatSourcePart[] = [];
      for (const row of rows.filter(isRecord)) {
        const items = Array.isArray(row.items) ? row.items.filter(isRecord) : [];
        const rowParts = (items.length > 0 ? items : [row]).flatMap(item => oldSourcePart(item) ?? []);
        rowParts.forEach(rememberLabel);
        parts.push(...rowParts);
        const { index } = row;
        if (typeof index !== 'number' || numbers.has(index) || rowParts.length === 0) continue;
        if (rowParts.length === 1) {
          numbers.set(index, { source: citationSourceOfPart(rowParts[0]) });
          continue;
        }
        // A grouped row: `[N]` names the table, which is a source of its own.
        const type = parseRecordHref(rowParts[0].sourceId)?.type ?? text(row.documentType);
        if (!type) continue;
        const collection: ChatSourcePart = {
          type: 'source-document',
          sourceId: collectionHref(type),
          mediaType: 'text/plain',
          title: text(row.label) ?? text(row.name) ?? type,
        };
        numbers.set(index, { source: citationSourceOfPart(collection), part: collection });
      }
      return parts;
    },
    remember: parts => parts.forEach(rememberLabel),
    numbered: number => numbers.get(number),
    labelOf: uri => labels.get(uri),
  };
}

/** The records an old `RECORD_CARDS` row or frame shows. */
export function oldRecordCardsOf(row: Record<string, unknown>): string[] {
  if (!Array.isArray(row.cards)) return [];
  const uris = row.cards
    .filter(isRecord)
    .map(card =>
      typeof card.entityType === 'string' && typeof card.entityId === 'string'
        ? recordHref(card.entityType, card.entityId)
        : null,
    )
    .filter((uri): uri is string => uri !== null);
  return [...new Set(uris)];
}

/**
 * Old video rows, as the sources they are now. A hero video lives on its document's own row and its `ref` names that
 * document, whose URI is its handle already, so it gives no source.
 */
export function oldVideoParts(rows: unknown): ChatSourcePart[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isRecord).flatMap(row => {
    const linked = oldLinkedRecord(row);
    if (linked && linked.type !== 'video') return [];
    const id = linked?.id ?? text(row.id);
    if (!id) return [];
    const sourceId = recordHref('video', id);
    const title = text(row.title) ?? id;
    const url = text(row.url);
    return [
      url
        ? { type: 'source-url' as const, sourceId, url, title }
        : { type: 'source-document' as const, sourceId, mediaType: 'text/plain', title },
    ];
  });
}

// =============================================================================
// Old Mingo shapes
// =============================================================================

/** The source rows a `GUIDE` entry holds: the envelope `ATTACHMENTS` replaced, the same arrays under `payload`. */
export function oldGuidePayload(raw: Record<string, unknown>): Record<string, unknown> | null {
  return isRecord(raw.payload) ? raw.payload : null;
}

/** An approval's id in its old name. */
export function oldApprovalRequestId(raw: Record<string, unknown>): string | undefined {
  return text(raw.approval_request_id);
}

/** An approval row with no tool list: its command is all there is. */
export function oldSingleApprovalChunks(
  data: Record<string, unknown>,
  requestId: string,
  approvalType: string,
): UiChunk[] {
  const command = typeof data.command === 'string' ? data.command : '';
  const explanation = typeof data.explanation === 'string' && data.explanation !== '' ? data.explanation : undefined;
  return [
    {
      type: 'tool-input-available',
      toolCallId: requestId,
      toolName: 'command',
      input: {},
      dynamic: true,
      ...(command ? { title: command } : {}),
    },
    {
      type: 'tool-approval-request',
      approvalId: requestId,
      toolCallId: requestId,
      ...(explanation ? { reason: explanation } : {}),
      approvalDescriptor: { approvalType },
    },
  ];
}

/**
 * A tool row from before runs had an id (`toolExecutionRequestId`, nullable and added 2026-04-27): its tool and function
 * do not name a row, because a tool runs more than once. Each run opens an id of its own, a result closes the oldest open
 * run of its tool, and a turn's end leaves what it opened behind, so no run ever pairs across messages.
 */
export function createOldRunIds(): {
  open(data: Record<string, unknown>): string;
  close(data: Record<string, unknown>): string;
  endTurn(): void;
} {
  const running = new Map<string, string[]>();
  let next = 0;
  const keyOf = (data: Record<string, unknown>): string =>
    `${typeof data.integratedToolType === 'string' ? data.integratedToolType : ''}-${
      typeof data.toolFunction === 'string' ? data.toolFunction : ''
    }`;
  const mint = (key: string): string => `run:${key}:${++next}`;

  return {
    open(data) {
      const key = keyOf(data);
      const id = mint(key);
      running.set(key, [...(running.get(key) ?? []), id]);
      return id;
    },
    close(data) {
      const key = keyOf(data);
      const [oldest, ...rest] = running.get(key) ?? [];
      if (oldest === undefined) return mint(key);
      running.set(key, rest);
      return oldest;
    },
    endTurn() {
      running.clear();
    },
  };
}

// =============================================================================
// Tokens in a text
// =============================================================================

type OldTextOp = { kind: 'text'; text: string } | { kind: 'cite'; numbers: number[] } | { kind: 'card'; uri: string };

const CARD_OPEN = '[card://';
const CARD = /\[card:\/\/([a-zA-Z0-9_-]+):([^\]\r\n)]+)[\])]/y;
const CARD_DESTINATION_OPEN = '(card://';
const CARD_DESTINATION = /\(card:\/\/([a-zA-Z0-9_-]+):([^\]\r\n)]+)\)/y;
const MENTION = /@([a-zA-Z]+):([A-Za-z0-9_.+/=-]*[A-Za-z0-9_+/=])/y;
/** An `@` after one of these is inside a word, an address or a url. */
const NOT_BEFORE_MENTION = /[\w@/.=\-%&?#+:\\]/;
const CHIP_RUN = new RegExp(CITATION_CHIP_RUN, 'y');
const CHIP_FOLLOW = new RegExp(CITATION_CHIP_FOLLOW);
const FENCE_LINE = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})(.*)$/;
const FENCE_PREFIX = /^[ \t]*(?:>[ \t]*)*(?:`*|~*)$/;
const SPECIAL = /[\\`[@(\n]/g;

/**
 * A text's old tokens, as it arrives:
 *   - `[card://t:i]` alone on a line is a card at that place; in a sentence it is a record link there and a card after
 *     its paragraph. A malformed one is removed. Inside code it stays as written;
 *   - `@marker:id` is a record link, its label the token itself until the host's chip resolves a name;
 *   - `[N]` standing apart from a word is removed, with the spaces before it, and reported at that place.
 *
 * `mentionsOnly` is a person's text: only the `@marker:id` of an old composer means anything there.
 */
function createOldTextConverter(
  labelOf: (uri: string) => string | undefined,
  { mentionsOnly = false }: { mentionsOnly?: boolean } = {},
): {
  push(slice: string): OldTextOp[];
  flush(): OldTextOp[];
} {
  let pending = '';
  /** Written, and held back while it could still be the spaces before a chip. */
  let carried = '';
  let previous = '';
  /** The last character written that is no space or tab: what stands before a chip once its spaces are removed. */
  let previousSolid = '';
  let lineBlank = true;
  let fence: { char: string; length: number } | null = null;
  let heldCards: string[] = [];
  let swallowingSpace = false;

  function run(final: boolean): OldTextOp[] {
    const ops: OldTextOp[] = [];
    let out = carried;
    carried = '';
    let i = 0;

    const write = (written: string): void => {
      if (written === '') return;
      out += written;
      previous = written[written.length - 1];
      const solid = written.replace(/[ \t]+$/, '');
      if (solid !== '') previousSolid = solid[solid.length - 1];
      const newline = written.lastIndexOf('\n');
      const tail = newline === -1 ? written : written.slice(newline + 1);
      lineBlank = (newline !== -1 || lineBlank) && tail.trim() === '';
    };
    const emitText = (): void => {
      if (out !== '') ops.push({ kind: 'text', text: out });
      out = '';
    };
    const atLineStart = (): boolean => previous === '' || previous === '\n';

    scan: while (i < pending.length) {
      if (swallowingSpace) {
        const space = /^\s*/.exec(pending.slice(i))?.[0] ?? '';
        i += space.length;
        if (i >= pending.length) break;
        swallowingSpace = false;
      }

      if (atLineStart() || fence) {
        const newline = pending.indexOf('\n', i);
        const line = newline === -1 ? pending.slice(i) : pending.slice(i, newline);
        const whole = line + (newline === -1 ? '' : '\n');
        const match = atLineStart() ? FENCE_LINE.exec(line) : null;
        if (newline === -1 && !final && atLineStart() && (FENCE_PREFIX.test(line) || match)) break;
        if (fence) {
          if (match && match[1][0] === fence.char && match[1].length >= fence.length && match[2].trim() === '') {
            fence = null;
          }
          write(whole);
          i += whole.length;
          continue;
        }
        if (match && (match[1][0] !== '`' || !match[2].includes('`'))) {
          fence = { char: match[1][0], length: match[1].length };
          write(whole);
          i += whole.length;
          continue;
        }
      }

      const char = pending[i];
      switch (char) {
        case '\\': {
          if (i + 1 >= pending.length && !final) break scan;
          write(pending.slice(i, i + 2));
          i += 2;
          continue;
        }
        case '`': {
          let length = 1;
          while (pending[i + length] === '`') length++;
          if (i + length === pending.length && !final) break scan;
          const close = closingBacktickRun(pending, i + length, length);
          if (close !== -1) {
            // A closing run at the very end of what has arrived may yet grow into another length.
            if (close + length === pending.length && !final) break scan;
            write(pending.slice(i, close + length));
            i = close + length;
            continue;
          }
          if (!final && !/\n[ \t]*\n/.test(pending.slice(i + length))) break scan;
          write(pending.slice(i, i + length));
          i += length;
          continue;
        }
        case '[': {
          if (mentionsOnly) {
            write('[');
            i += 1;
            continue;
          }
          const head = pending.slice(i, i + CARD_OPEN.length);
          if (head.length < CARD_OPEN.length && CARD_OPEN.startsWith(head) && !final) break scan;
          if (head === CARD_OPEN) {
            CARD.lastIndex = i;
            const match = CARD.exec(pending);
            const tail = pending.slice(i);
            if (!match) {
              const stop = tail.search(/[\])\r\n]/);
              if (stop === -1 && !final) break scan;
              if (stop === -1) i = pending.length;
              else i += tail[stop] === ']' || tail[stop] === ')' ? stop + 1 : stop;
              continue;
            }
            const after = tail.slice(match[0].length);
            if (lineBlank) {
              if (!final && /^[ \t]*$/.test(after)) break scan;
              if (/^[ \t]*(?:\r?\n|$)/.test(after)) {
                emitText();
                ops.push({ kind: 'card', uri: recordHref(match[1], match[2]) });
                i += match[0].length;
                previous = '\n';
                previousSolid = '\n';
                lineBlank = true;
                swallowingSpace = true;
                continue;
              }
            }
            const uri = recordHref(match[1], match[2]);
            write(recordLinkMarkdown({ type: match[1], id: match[2] }, labelOf(uri) ?? match[2]));
            if (!heldCards.includes(uri)) heldCards.push(uri);
            i += match[0].length;
            continue;
          }
          if (previous === '' || /\s/.test(previous)) {
            const tail = pending.slice(i);
            if (!final && /^\[[\d,\s]*$/.test(tail)) break scan;
            CHIP_RUN.lastIndex = i;
            const match = CHIP_RUN.exec(pending);
            if (match) {
              const after = tail.slice(match[0].length);
              if (!final && (after === '' || /^\[[\d,\s]*$/.test(after))) break scan;
              if (after === '' || CHIP_FOLLOW.test(after[0])) {
                out = out.replace(/[ \t]+$/, '');
                previous = previousSolid;
                emitText();
                ops.push({ kind: 'cite', numbers: [...match[0].matchAll(/\d+/g)].map(n => Number(n[0])) });
                i += match[0].length;
                // Nothing of its line before it: the space after it would open the line.
                if (atLineStart()) swallowingSpace = true;
                continue;
              }
            }
          }
          write('[');
          i += 1;
          continue;
        }
        case '@': {
          if (previous !== '' && NOT_BEFORE_MENTION.test(previous)) {
            write('@');
            i += 1;
            continue;
          }
          MENTION.lastIndex = i;
          const match = MENTION.exec(pending);
          const tail = pending.slice(i);
          if (!final && /^@[a-zA-Z]*(?::[A-Za-z0-9_.+/=-]*)?$/.test(tail)) break scan;
          if (!match) {
            write('@');
            i += 1;
            continue;
          }
          write(recordLinkMarkdown({ type: match[1], id: match[2] }, match[0]));
          i += match[0].length;
          continue;
        }
        case '(': {
          if (previous === ']' && !mentionsOnly) {
            const head = pending.slice(i, i + CARD_DESTINATION_OPEN.length);
            if (head.length < CARD_DESTINATION_OPEN.length && CARD_DESTINATION_OPEN.startsWith(head) && !final)
              break scan;
            if (head === CARD_DESTINATION_OPEN) {
              CARD_DESTINATION.lastIndex = i;
              const match = CARD_DESTINATION.exec(pending);
              if (match) {
                write(`(${recordHref(match[1], match[2])})`);
                i += match[0].length;
                continue;
              }
              if (!final && !/[\])\r\n]/.test(pending.slice(i))) break scan;
            }
          }
          write('(');
          i += 1;
          continue;
        }
        case '\n': {
          if (heldCards.length > 0) {
            const tail = pending.slice(i);
            if (!final && /^\n[ \t]*$/.test(tail)) break scan;
            if (/^\n[ \t]*(?:\n|$)/.test(tail)) {
              emitText();
              for (const uri of heldCards) ops.push({ kind: 'card', uri });
              heldCards = [];
            }
          }
          write('\n');
          i += 1;
          continue;
        }
        default: {
          SPECIAL.lastIndex = i + 1;
          const next = SPECIAL.exec(pending);
          const end = next ? next.index : pending.length;
          write(pending.slice(i, end));
          i = end;
        }
      }
    }

    pending = pending.slice(i);
    if (final) {
      write(pending);
      pending = '';
      emitText();
      for (const uri of heldCards) ops.push({ kind: 'card', uri });
      heldCards = [];
    } else {
      const spaces = /[ \t]+$/.exec(out);
      if (spaces) {
        carried = spaces[0];
        out = out.slice(0, spaces.index);
      }
      emitText();
    }
    return ops;
  }

  return {
    push(slice) {
      pending += slice;
      return run(false);
    },
    flush() {
      const ops = run(true);
      // The text part ended, and each is a markdown document of its own: nothing about this line carries over.
      previous = '';
      previousSolid = '';
      lineBlank = true;
      fence = null;
      swallowingSpace = false;
      return ops;
    },
  };
}

/**
 * A person's text with its `@marker:id` tokens as record links: an old composer wrote them, and they drew as chips. One
 * inside code stays code.
 */
export function oldMentionsToRecordLinks(content: string): string {
  if (!content.includes('@')) return content;
  const converter = createOldTextConverter(() => undefined, { mentionsOnly: true });
  return [...converter.push(content), ...converter.flush()].map(op => (op.kind === 'text' ? op.text : '')).join('');
}

// =============================================================================
// A text's slices as chunks
// =============================================================================

/**
 * One turn's answer text as chunks. A wire text id stays open across slices. A citation waits for the `text-end` that
 * carries it, the only chunk that can, and text after it closes that id and opens a new one, so a run of chips lands on
 * one `text-end`. One with no text before it on its id waits for the next id, at its start. `citations: false` is Mingo,
 * where a stray number is removed and cites nothing.
 */
export function createOldTextWriter(
  index: OldSourceIndex,
  mintId: () => string,
  options: { citations: boolean } = { citations: true },
): {
  push(slice: string): UiChunk[];
  /** Flushes what is held and closes the wire id: what follows is drawn after this text. */
  close(): UiChunk[];
} {
  const converter = createOldTextConverter(index.labelOf);
  let id: string | null = null;
  let length = 0;
  let held: ChatCitation[] = [];

  function closeId(): UiChunk[] {
    if (id === null) return [];
    const chunk: UiChunk = { type: 'text-end', id, ...(held.length > 0 ? { citations: held } : {}) };
    id = null;
    held = [];
    return [chunk];
  }

  function chunksOf(ops: OldTextOp[]): UiChunk[] {
    const out: UiChunk[] = [];
    for (const op of ops) {
      if (op.kind === 'text') {
        if (id !== null && held.length > 0) out.push(...closeId());
        if (id === null) {
          id = mintId();
          length = 0;
          out.push({ type: 'text-start', id });
        }
        out.push({ type: 'text-delta', id, delta: op.text });
        length += op.text.length;
      } else if (op.kind === 'card') {
        out.push(...closeId(), { type: 'data-record-cards', data: { records: [op.uri] } });
      } else if (options.citations) {
        for (const number of op.numbers) {
          const numbered = index.numbered(number);
          if (!numbered) continue;
          if (numbered.part) out.push(numbered.part);
          held.push({ source: numbered.source, endIndex: id === null ? 0 : length });
        }
      }
    }
    return out;
  }

  return {
    push: slice => chunksOf(converter.push(slice)),
    close: () => [...chunksOf(converter.flush()), ...closeId()],
  };
}

// =============================================================================
// An old stored row
// =============================================================================

/**
 * An old row as the parts a row holds: sources, then text and cards. A user row is its text, verbatim, tokens included:
 * it is what the person typed. An answer's `content`, or its parts when it has them, goes through the token converter.
 */
export function oldStoredRowToParts(row: Record<string, unknown>): ChatPart[] {
  const content = typeof row.content === 'string' ? row.content : '';
  if (row.role === 'user') return content === '' ? [] : [{ type: 'text', text: content }];

  const index = createOldSourceIndex();
  const wire = createWireState();
  let nextId = 0;
  const writer = createOldTextWriter(index, () => `t${++nextId}`);
  let parts: ChatPart[] = [];
  const apply = (chunks: readonly UiChunk[]): void => {
    for (const chunk of chunks) parts = applyChunk(parts, chunk, wire);
  };

  apply(index.register(row.sources));
  const stored = Array.isArray(row.parts) ? row.parts.filter(isRecord) : null;
  if (stored) {
    for (const part of stored) {
      if (part.type === 'text' && typeof part.text === 'string') {
        apply(writer.push(part.text));
      } else if (part.type === 'RECORD_CARDS' || part.type === 'data-record-cards') {
        const records =
          part.type === 'RECORD_CARDS'
            ? oldRecordCardsOf(part)
            : normalizeRecordUris(isRecord(part.data) ? part.data.records : undefined);
        apply(writer.close());
        if (records.length > 0) apply([{ type: 'data-record-cards', data: { records } }]);
      }
    }
  } else {
    apply(writer.push(content));
  }
  apply(writer.close());
  return storablePartsOf(parts);
}

/** A stored row's metadata in its old names. */
export function oldStoredRowMetadata(row: Record<string, unknown>): ChatMessageMetadata {
  return {
    ...(typeof row.seq === 'number' ? { seq: row.seq } : {}),
    ...(typeof row.created_at === 'string' ? { createdAt: row.created_at } : {}),
    ...(row.kind === 'approval_receipt' ? { kind: 'approval_receipt' as const } : {}),
    ...(row.aborted === true ? { aborted: true } : {}),
  };
}

// =============================================================================
// The old byte frames
// =============================================================================

const FRAME_TERMINATOR = '\0';
const END_OF_LEADING = '\x1E';
const TRAILER_SENTINEL = '\x1F';
const INLINE_FRAME = '\x1D';

function usageOfOldFrame(frame: Record<string, unknown>): ChatUsage {
  const number = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined);
  const inputTokens = number(frame.input_tokens);
  const outputTokens = number(frame.output_tokens);
  const cacheReadTokens = number(frame.cache_read_input_tokens);
  const cacheWriteTokens = number(frame.cache_creation_input_tokens);
  const hit = number(frame.hit_rate_pct);
  const telemetry = isRecord(frame.telemetry) ? frame.telemetry : null;
  const hasDetails = cacheReadTokens !== undefined || cacheWriteTokens !== undefined;
  return {
    ...(inputTokens !== undefined ? { inputTokens } : {}),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(hasDetails
      ? {
          inputTokenDetails: {
            ...(cacheReadTokens !== undefined ? { cacheReadTokens } : {}),
            ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
          },
        }
      : {}),
    ...(hit !== undefined ? { hit_rate_pct: hit } : {}),
    ...(telemetry &&
    typeof telemetry.cards === 'number' &&
    typeof telemetry.chips === 'number' &&
    typeof telemetry.sentences === 'number' &&
    typeof telemetry.answerLen === 'number'
      ? {
          telemetry: {
            cards: telemetry.cards,
            citations: telemetry.chips,
            sentences: telemetry.sentences,
            answerLen: telemetry.answerLen,
          },
        }
      : {}),
    ...(isRecord(frame.breakdown) ? { breakdown: frame.breakdown } : {}),
    ...(isRecord(frame.debug) ? { debug: frame.debug } : {}),
    ...(typeof frame.stop_reason === 'string' ? { stop_reason: frame.stop_reason } : {}),
    ...(typeof frame.stop_detail === 'string' ? { stop_detail: frame.stop_detail } : {}),
  };
}

function fieldsOf(raw: unknown): Array<{ label: string; value: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .filter(field => typeof field.label === 'string' && field.label && typeof field.value === 'string' && field.value)
    .map(field => ({ label: field.label as string, value: field.value as string }));
}

function isProgressStage(value: unknown): value is ChatProgressStage {
  return (CHAT_PROGRESS_STAGES as readonly unknown[]).includes(value);
}

/**
 * The old byte frames as chunks. The stream's quirks stay as they were: a leading block that is not JSON flips the
 * stream into text, whole; a malformed frame inside the text is dropped and the text goes on; `end()` drops a leading
 * buffer nothing terminated. A body that closes with no trailer ends as `finish` with `other`, never `interrupted`: the
 * old hub closes a rejected approval with no trailer at all, and such a stream drew no notice. A read that failed is
 * `interrupted`.
 */
export function createOldFrameDecoder(): { push(bytes: Uint8Array): UiChunk[]; end(cut?: boolean): UiChunk[] } {
  const decoder = new TextDecoder();
  const index = createOldSourceIndex();
  let nextId = 0;
  const writer = createOldTextWriter(index, () => `t${++nextId}`);
  let buffer = '';
  let inText = false;
  let inTrailer = false;
  let trailer = '';
  let inlineFrame: string | null = null;
  let started = false;
  let reasoningId: string | null = null;
  let ended = false;

  function ensureStart(out: UiChunk[]): void {
    if (started) return;
    started = true;
    out.push({ type: 'start' });
  }

  function closeReasoning(out: UiChunk[]): void {
    if (reasoningId === null) return;
    out.push({ type: 'reasoning-end', id: reasoningId });
    reasoningId = null;
  }

  function writeText(slice: string, out: UiChunk[]): void {
    if (slice === '') return;
    ensureStart(out);
    closeReasoning(out);
    out.push(...writer.push(slice));
  }

  /** What follows is drawn after the text so far. */
  function closeOpen(out: UiChunk[]): void {
    closeReasoning(out);
    out.push(...writer.close());
  }

  function approvalPair(proposal: Record<string, unknown>, batchId: string | undefined, out: UiChunk[]): void {
    if (!proposal.proposalId) return;
    const id = String(proposal.proposalId);
    const fields = fieldsOf(proposal.fields);
    const title = text(proposal.title);
    out.push(
      {
        type: 'tool-input-available',
        toolCallId: id,
        toolName: String(proposal.toolName ?? 'tool'),
        input: isRecord(proposal.args) ? proposal.args : {},
        dynamic: true,
        ...(title ? { title } : {}),
      },
      {
        type: 'tool-approval-request',
        approvalId: id,
        toolCallId: id,
        approvalDescriptor: {
          ...(fields.length > 0 ? { fields } : {}),
          ...(typeof proposal.expiresAt === 'string' ? { expiresAt: proposal.expiresAt } : {}),
          ...(typeof proposal.ttlSeconds === 'number' ? { ttlSeconds: proposal.ttlSeconds } : {}),
          ...(batchId ? { batchId } : {}),
        },
      },
    );
  }

  function readFrame(frame: Record<string, unknown>, out: UiChunk[]): void {
    ensureStart(out);
    if (frame.status === 'thinking') return;
    if (frame.type === 'EXECUTING_TOOL' || frame.type === 'EXECUTED_TOOL') {
      const stage = frame.toolFunction;
      if (!isProgressStage(stage)) return;
      const count = typeof frame.title === 'string' ? /\d+/.exec(frame.title)?.[0] : undefined;
      out.push({
        type: 'data-chat-progress',
        id: String(frame.toolExecutionRequestId ?? stage),
        transient: true,
        data: {
          stage,
          ...(count ? { count: Number(count) } : {}),
          state: frame.type === 'EXECUTING_TOOL' ? 'running' : frame.success === false ? 'failed' : 'done',
        },
      });
      return;
    }
    if (frame.type === 'RECORD_CARDS') {
      closeOpen(out);
      const records = oldRecordCardsOf(frame);
      if (records.length > 0) out.push({ type: 'data-record-cards', data: { records } });
      return;
    }
    switch (frame.kind) {
      case 'thinking-delta':
        if (typeof frame.text !== 'string') return;
        if (reasoningId === null) {
          reasoningId = `r${++nextId}`;
          out.push({ type: 'reasoning-start', id: reasoningId });
        }
        out.push({ type: 'reasoning-delta', id: reasoningId, delta: frame.text });
        return;
      case 'usage':
        if (frame.stage === 'start') {
          out.push({ type: 'message-metadata', messageMetadata: { usage: usageOfOldFrame(frame) } });
        }
        return;
      case 'text-leading':
        if (typeof frame.text === 'string') writeText(frame.text, out);
        return;
      case 'tool_error': {
        closeOpen(out);
        const errorText = text(frame.message) ?? 'Could not complete the requested action right now.';
        const toolCallId = text(frame.toolUseId);
        if (toolCallId) {
          out.push({
            type: 'tool-input-error',
            toolCallId,
            toolName: text(frame.toolName) ?? 'tool',
            input: {},
            dynamic: true,
            errorText,
          });
        } else {
          out.push({ type: 'data-error', data: { title: errorText } });
        }
        return;
      }
      case 'approval_request':
        closeOpen(out);
        approvalPair(frame, undefined, out);
        return;
      case 'approval_batch':
        closeOpen(out);
        if (Array.isArray(frame.proposals)) {
          for (const proposal of frame.proposals.filter(isRecord)) approvalPair(proposal, String(frame.batchId), out);
        }
        return;
      case 'decision_resolved': {
        closeOpen(out);
        const toolCallId = String(frame.proposalId ?? '');
        const receipt = typeof frame.receiptText === 'string' ? frame.receiptText : null;
        const willAutoContinue = frame.willAutoContinue === true;
        if (toolCallId) {
          if (frame.action === 'rejected') {
            out.push({ type: 'tool-output-denied', toolCallId });
          } else if (frame.ok === true) {
            out.push({ type: 'tool-output-available', toolCallId, dynamic: true, output: frame.result ?? {} });
          } else {
            out.push({
              type: 'tool-output-error',
              toolCallId,
              dynamic: true,
              errorText: receipt ?? 'The action failed.',
            });
          }
        }
        if (receipt !== null) {
          // Each answer of a batch writes one, and text coalesces: the break keeps them apart.
          writeText(`${receipt}\n\n`, out);
          out.push(...writer.close());
        }
        if (isRecord(frame.record_cards)) {
          const records = oldRecordCardsOf(frame.record_cards);
          if (records.length > 0) out.push({ type: 'data-record-cards', data: { records } });
        }
        out.push({ type: 'message-metadata', messageMetadata: { willAutoContinue } });
        return;
      }
      case 'routing':
        if (typeof frame.routedComplexity === 'string') {
          out.push({
            type: 'message-metadata',
            messageMetadata: {
              routing: {
                complexity: frame.routedComplexity,
                ...(typeof frame.routedModel === 'string' ? { model: frame.routedModel } : {}),
                thinkingBudget: typeof frame.routedThinkingBudget === 'number' ? frame.routedThinkingBudget : null,
              },
            },
          });
        }
        return;
      default: {
        const metadata: ChatMessageMetadata = {
          ...(typeof frame.conversationId === 'string' ? { conversationId: frame.conversationId } : {}),
          ...(typeof frame.model === 'string' ? { model: frame.model } : {}),
          ...(typeof frame.modelLabel === 'string' ? { modelLabel: frame.modelLabel } : {}),
          ...(typeof frame.provider === 'string' ? { provider: frame.provider } : {}),
          ...(typeof frame.contextWindowMaxTokens === 'number'
            ? { contextWindowMaxTokens: frame.contextWindowMaxTokens }
            : {}),
          ...(typeof frame.scrollAnchor === 'string' ? { scrollAnchor: frame.scrollAnchor } : {}),
        };
        if (Object.keys(metadata).length > 0) out.push({ type: 'message-metadata', messageMetadata: metadata });
        out.push(...(index.register(frame.sources) as UiChunk[]));
      }
    }
  }

  function pushText(slice: string, out: UiChunk[]): void {
    let rest = slice;
    while (rest.length > 0 && !inTrailer) {
      if (inlineFrame !== null) {
        const frameEnd = rest.indexOf(FRAME_TERMINATOR);
        if (frameEnd === -1) {
          inlineFrame += rest;
          return;
        }
        const raw = inlineFrame + rest.slice(0, frameEnd);
        inlineFrame = null;
        rest = rest.slice(frameEnd + 1);
        try {
          const frame: unknown = JSON.parse(raw);
          if (isRecord(frame)) readFrame(frame, out);
        } catch {
          // A malformed frame inside the answer is dropped; the answer goes on.
        }
        continue;
      }
      const frameAt = rest.indexOf(INLINE_FRAME);
      const trailerAt = rest.indexOf(TRAILER_SENTINEL);
      if (trailerAt !== -1 && (frameAt === -1 || trailerAt < frameAt)) {
        writeText(rest.slice(0, trailerAt), out);
        inTrailer = true;
        trailer = rest.slice(trailerAt + 1);
        return;
      }
      if (frameAt === -1) {
        writeText(rest, out);
        return;
      }
      writeText(rest.slice(0, frameAt), out);
      inlineFrame = '';
      rest = rest.slice(frameAt + 1);
    }
  }

  return {
    push(bytes) {
      const out: UiChunk[] = [];
      const slice = decoder.decode(bytes, { stream: true });
      if (inTrailer) {
        trailer += slice;
        return out;
      }
      if (inText) {
        pushText(slice, out);
        return out;
      }
      buffer += slice;
      while (!inText) {
        const leadingEnd = buffer.indexOf(END_OF_LEADING);
        const frameEnd = buffer.indexOf(FRAME_TERMINATOR);
        if (leadingEnd !== -1 && (frameEnd === -1 || leadingEnd < frameEnd)) {
          inText = true;
          ensureStart(out);
          const after = buffer.slice(leadingEnd + 1);
          buffer = '';
          if (after) pushText(after, out);
          break;
        }
        if (frameEnd === -1) break;
        let frame: unknown;
        try {
          frame = JSON.parse(buffer.slice(0, frameEnd));
        } catch {
          // Not JSON: the start of an answer with no frames. The whole buffer is its text.
          inText = true;
          const whole = buffer;
          buffer = '';
          writeText(whole, out);
          break;
        }
        readFrame(isRecord(frame) ? frame : {}, out);
        buffer = buffer.slice(frameEnd + 1);
      }
      return out;
    },
    end(cut = false) {
      if (ended) return [];
      ended = true;
      const out: UiChunk[] = [];
      ensureStart(out);
      closeOpen(out);
      let usage: ChatUsage | null = null;
      if (trailer !== '') {
        try {
          const frame: unknown = JSON.parse(trailer);
          if (isRecord(frame) && frame.kind === 'usage') usage = usageOfOldFrame(frame);
        } catch {
          // A malformed trailer is ignored, as it always was.
        }
      }
      const finishReason = usage ? finishReasonOfStop(usage.stop_reason ?? 'end_turn') : cut ? 'interrupted' : 'other';
      if (finishReason === null) {
        out.push(
          { type: 'message-metadata', messageMetadata: { usage: usage ?? {} } },
          { type: 'abort', reason: usage?.stop_reason === 'timeout' ? 'timeout' : 'aborted' },
        );
      } else {
        out.push({ type: 'finish', finishReason, ...(usage ? { messageMetadata: { usage } } : {}) });
      }
      return out;
    },
  };
}

// =============================================================================
// `/api/docs/search`
// =============================================================================

/** A search row's identity and address, whichever names it answers in. */
export function oldDocSearchFields(row: Record<string, unknown>): {
  sourceId: string | null;
  title: string;
  url: string | null;
} {
  return {
    sourceId: oldRecordUri(row),
    title: text(row.name) ?? '',
    url: oldUrl(row) ?? null,
  };
}
