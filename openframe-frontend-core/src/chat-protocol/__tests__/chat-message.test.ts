/**
 * The rules of the stored message: what a row holds, the one text helper, and where an approval stands. The shapes
 * themselves are held to the real AI SDK by `ai-sdk-conformance.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import {
  APPROVAL_CANCELLED,
  approvalRequestIdOf,
  approvalStatusOf,
  parseCitations,
  parseStoredParts,
  storablePartsOf,
  textOfParts,
  type ChatCitation,
  type ChatMessage,
  type ChatPart,
  type ChatToolPart,
} from '../chat-message';
import { parseCollectionHref, parseRecordHref } from '../record-link';
import { HISTORY_RESPONSE, STORED_ANSWER_PARTS, STORED_RECEIPT_PARTS, STORED_USER_PARTS } from '../wire-fixtures';

const source: ChatCitation['source'] = {
  type: 'source',
  sourceType: 'url',
  id: 'record://blog_post/1',
  url: 'https://www.flamingo.run/blog/a',
};

describe('textOfParts', () => {
  it('is the text of a stored row, byte for byte, when the text carries its own breaks', () => {
    const parts: ChatPart[] = [
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://x.test' },
      { type: 'text', text: 'Before the card.\n\n' },
      { type: 'data-record-cards', data: { records: ['record://a/1'] } },
      { type: 'text', text: '\n\nAfter the card.' },
    ];
    expect(textOfParts(parts)).toBe('Before the card.\n\n\n\nAfter the card.');
  });

  it('gives parts that meet with no newline a paragraph break, as Mingo text at a tool row', () => {
    const parts: ChatPart[] = [
      { type: 'text', text: 'Let me check.' },
      { type: 'dynamic-tool', toolName: 'x', toolCallId: '1', state: 'input-available', input: {} },
      { type: 'text', text: 'Found it.' },
    ];
    expect(textOfParts(parts)).toBe('Let me check.\n\nFound it.');
  });

  it('adds no break when one side already has a newline, and skips an empty part', () => {
    expect(
      textOfParts([
        { type: 'text', text: 'a\n' },
        { type: 'text', text: 'b' },
        { type: 'text', text: '' },
        { type: 'text', text: '\nc' },
      ]),
    ).toBe('a\nb\nc');
  });

  it('is empty for no text', () => {
    expect(textOfParts([])).toBe('');
    expect(textOfParts([{ type: 'reasoning', text: 'thinking' }])).toBe('');
  });
});

describe('storablePartsOf', () => {
  it('keeps text, sources, files and record cards, and drops everything else', () => {
    const parts: ChatPart[] = [
      { type: 'reasoning', text: 'thinking', state: 'done' },
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://x.test' },
      { type: 'file', mediaType: 'image/png', url: 'https://x.test/a.png' },
      { type: 'text', text: 'text', state: 'done' },
      { type: 'data-ask', data: { question: 'q', options: [] } },
      { type: 'data-error', data: { title: 'bad' } },
      { type: 'dynamic-tool', toolName: 'x', toolCallId: '1', state: 'input-available', input: {} },
      { type: 'data-record-cards', data: { records: ['record://a/1'] } },
    ];
    expect(storablePartsOf(parts)).toEqual([
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://x.test' },
      { type: 'file', mediaType: 'image/png', url: 'https://x.test/a.png' },
      { type: 'text', text: 'text' },
      { type: 'data-record-cards', data: { records: ['record://a/1'] } },
    ]);
  });

  it('drops `state`: it is memory only', () => {
    const [part] = storablePartsOf([{ type: 'text', text: 'a', state: 'streaming' }]);
    expect(part).toEqual({ type: 'text', text: 'a' });
    expect(part).not.toHaveProperty('state');
  });

  it('merges text-reasoning-text with nothing added, rebasing the citations', () => {
    const parts: ChatPart[] = [
      { type: 'text', text: 'One two ', citations: [{ source, startIndex: 0, endIndex: 3 }] },
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text: 'three.', citations: [{ source, startIndex: 0, endIndex: 6 }] },
    ];
    expect(storablePartsOf(parts)).toEqual([
      {
        type: 'text',
        text: 'One two three.',
        citations: [
          { source, startIndex: 0, endIndex: 3 },
          { source, startIndex: 8, endIndex: 14 },
        ],
      },
    ]);
  });

  it('rebases a citation that knows only its end', () => {
    const parts: ChatPart[] = [
      { type: 'text', text: 'One ' },
      { type: 'reasoning', text: 'thinking' },
      { type: 'text', text: 'two', citations: [{ source, endIndex: 3 }] },
    ];
    expect(storablePartsOf(parts)).toEqual([{ type: 'text', text: 'One two', citations: [{ source, endIndex: 7 }] }]);
  });

  it('merges across a dropped tool row with the break the live message draws there', () => {
    const parts: ChatPart[] = [
      { type: 'text', text: 'Let me check.' },
      { type: 'dynamic-tool', toolName: 'x', toolCallId: '1', state: 'output-error', input: {}, errorText: 'no' },
      { type: 'text', text: 'Found it.', citations: [{ source, endIndex: 9 }] },
    ];
    const stored = storablePartsOf(parts);
    expect(stored).toEqual([
      { type: 'text', text: 'Let me check.\n\nFound it.', citations: [{ source, endIndex: 24 }] },
    ]);
    expect(textOfParts(stored)).toBe(textOfParts(parts));
  });

  it('never merges across what stays: a card splits the text', () => {
    const parts: ChatPart[] = [
      { type: 'text', text: 'a' },
      { type: 'data-record-cards', data: { records: ['record://a/1'] } },
      { type: 'text', text: 'b' },
    ];
    expect(storablePartsOf(parts)).toEqual(parts);
  });

  it('leads with sources, in arrival order, unique by sourceId (first wins)', () => {
    const parts: ChatPart[] = [
      { type: 'text', text: 'a' },
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://first.test', title: 'First' },
      { type: 'source-url', sourceId: 'record://a/2', url: 'https://x.test' },
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://second.test', title: 'Second' },
    ];
    expect(storablePartsOf(parts)).toEqual([
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://first.test', title: 'First' },
      { type: 'source-url', sourceId: 'record://a/2', url: 'https://x.test' },
      { type: 'text', text: 'a' },
    ]);
  });

  it('an empty answer is `[]`, plus its sources when it has them', () => {
    expect(storablePartsOf([])).toEqual([]);
    expect(storablePartsOf([{ type: 'text', text: '', state: 'done' }])).toEqual([]);
    expect(
      storablePartsOf([
        { type: 'source-url', sourceId: 'record://a/1', url: 'https://x.test' },
        { type: 'text', text: '' },
      ]),
    ).toEqual([{ type: 'source-url', sourceId: 'record://a/1', url: 'https://x.test' }]);
  });

  it('leaves `citations` out when there are none', () => {
    const [part] = storablePartsOf([
      { type: 'text', text: 'a', citations: [] },
      { type: 'text', text: 'b' },
    ]);
    expect(part).not.toHaveProperty('citations');
  });

  it('is what the stored fixtures hold', () => {
    for (const parts of [STORED_ANSWER_PARTS, STORED_USER_PARTS, STORED_RECEIPT_PARTS]) {
      expect(storablePartsOf(parts)).toEqual(parts);
    }
  });
});

describe('the stored fixtures keep the rules', () => {
  const rows = HISTORY_RESPONSE.messages;

  it('sources lead parts, unique by sourceId', () => {
    for (const { parts } of rows) {
      const ids = parts.flatMap(part => ('sourceId' in part ? [part.sourceId] : []));
      expect(new Set(ids).size).toBe(ids.length);
      expect(parts.slice(0, ids.length).every(part => 'sourceId' in part)).toBe(true);
    }
  });

  /** Every citation of the fixtures, with what it is checked against. */
  const citations = rows.flatMap(({ parts }) => {
    const ids = parts.flatMap(part => ('sourceId' in part ? [part.sourceId] : []));
    return parts.flatMap(part =>
      part.type === 'text' ? (part.citations ?? []).map(citation => ({ citation, ids, length: part.text.length })) : [],
    );
  });

  it('every citation names a source of its message, and its range is inside its part', () => {
    expect(citations.length).toBeGreaterThan(0);
    for (const { citation, ids, length } of citations) {
      expect(ids).toContain(citation.source.id);
      expect(citation.endIndex ?? 0).toBeLessThanOrEqual(length);
      expect(citation.startIndex ?? 0).toBeLessThanOrEqual(citation.endIndex ?? length);
    }
  });

  it('a citation carries no text of the record', () => {
    for (const { citation } of citations) expect(citation).not.toHaveProperty('citedText');
  });

  it('sourceId is the record URI, and a collection names no record', () => {
    const ids = STORED_ANSWER_PARTS.flatMap(part => ('sourceId' in part ? [part.sourceId] : []));
    expect(parseRecordHref(ids[0])).toEqual({ type: 'blog_post', id: '1108' });
    expect(parseRecordHref(ids[2])).toBeNull();
    expect(parseCollectionHref(ids[2])).toEqual({ type: 'blog_post' });
  });

  it('a record with no url is a source-document, with the mediaType the model was given', () => {
    const ticket = STORED_ANSWER_PARTS.find(part => 'sourceId' in part && part.sourceId.includes('ticket'));
    expect(ticket).toMatchObject({ type: 'source-document', mediaType: 'text/plain' });
    expect(ticket).not.toHaveProperty('url');
  });

  it('`file` appears on user rows only', () => {
    const answers = rows.filter(({ role }) => role !== 'user');
    expect(answers.some(({ parts }) => parts.some(part => part.type === 'file'))).toBe(false);
  });
});

describe('approvalStatusOf', () => {
  const base = { type: 'dynamic-tool', toolName: 'x', toolCallId: '1', input: {} } as const;

  it.each<[string, ChatToolPart, string | null]>([
    ['no approval', { ...base, state: 'input-available' }, null],
    ['requested', { ...base, state: 'approval-requested', approval: { id: '1' } }, 'pending'],
    ['approved, running', { ...base, state: 'approval-responded', approval: { id: '1', approved: true } }, 'approved'],
    [
      'rejected, in flight',
      { ...base, state: 'approval-responded', approval: { id: '1', approved: false } },
      'rejected',
    ],
    ['executed', { ...base, state: 'output-available', output: 1, approval: { id: '1', approved: true } }, 'approved'],
    ['failed', { ...base, state: 'output-error', errorText: 'no', approval: { id: '1', approved: true } }, 'approved'],
    ['denied', { ...base, state: 'output-denied', approval: { id: '1', approved: false } }, 'rejected'],
    [
      'cancelled',
      { ...base, state: 'output-denied', approval: { id: '1', approved: false, reason: APPROVAL_CANCELLED } },
      'cancelled',
    ],
    ['no gate, executed', { ...base, state: 'output-available', output: 1 }, null],
  ])('%s', (_name, part, status) => {
    expect(approvalStatusOf(part)).toBe(status);
  });
});

describe('parseStoredParts', () => {
  it('keeps what a row may hold, field by field', () => {
    expect(parseStoredParts(STORED_ANSWER_PARTS)).toEqual(STORED_ANSWER_PARTS);
    expect(parseStoredParts(STORED_USER_PARTS)).toEqual(STORED_USER_PARTS);
  });

  it('drops what it may not, and a malformed part, keeping the rest', () => {
    expect(
      parseStoredParts([
        null,
        { type: 'text' },
        { type: 'reasoning', text: 'x' },
        { type: 'dynamic-tool', toolName: 'x' },
        { type: 'source-url', sourceId: 'record://a/1' },
        { type: 'data-record-cards', data: { records: [] } },
        { type: 'text', text: 'kept', state: 'streaming' },
      ]),
    ).toEqual([{ type: 'text', text: 'kept' }]);
    expect(parseStoredParts('nope')).toEqual([]);
  });

  it('a source-document with no mediaType reads as what the model was given', () => {
    expect(parseStoredParts([{ type: 'source-document', sourceId: 'record://a/1', title: 'A' }])).toEqual([
      { type: 'source-document', sourceId: 'record://a/1', mediaType: 'text/plain', title: 'A' },
    ]);
  });
});

describe('the package`s entry', () => {
  it('publishes no test data', async () => {
    const entry = await import('../index');
    expect(entry).not.toHaveProperty('ANSWER_STREAM');
    expect(entry).not.toHaveProperty('RECORD_URI_VECTORS');
    expect(entry).not.toHaveProperty('FIXTURE_PROPOSAL_ID');
  });
});

describe('a stored row`s record URIs read in their one spelling', () => {
  const unencoded = 'record://markdown/docs/a.md';
  const canonical = 'record://markdown/docs%2Fa.md';

  it('a source part, and a citation`s source', () => {
    expect(
      parseStoredParts([
        { type: 'source-url', sourceId: unencoded, url: 'https://a.test' },
        { type: 'source-document', sourceId: unencoded, mediaType: 'text/plain', title: 'A' },
        {
          type: 'text',
          text: 'Cited.',
          citations: [
            { source: { type: 'source', sourceType: 'url', id: unencoded, url: 'https://a.test' }, endIndex: 6 },
          ],
        },
      ]),
    ).toEqual([
      { type: 'source-url', sourceId: canonical, url: 'https://a.test' },
      { type: 'source-document', sourceId: canonical, mediaType: 'text/plain', title: 'A' },
      {
        type: 'text',
        text: 'Cited.',
        citations: [
          { source: { type: 'source', sourceType: 'url', id: canonical, url: 'https://a.test' }, endIndex: 6 },
        ],
      },
    ]);
  });
});

describe('parseCitations', () => {
  it('drops a malformed citation and keeps the rest', () => {
    const good = { source, startIndex: 0, endIndex: 3 };
    expect(
      parseCitations([
        good,
        { source: { type: 'source', sourceType: 'url', id: 'x' } },
        { source: { type: 'source', sourceType: 'other', id: 'x' } },
        { startIndex: 1 },
        null,
      ]),
    ).toEqual([good]);
  });

  it('keeps offsets that are valid on their own', () => {
    expect(parseCitations([{ source, startIndex: -1, endIndex: 2.5 }])).toEqual([{ source }]);
    expect(parseCitations([{ source, endIndex: 4 }])).toEqual([{ source, endIndex: 4 }]);
  });

  it('never stores what a citation quoted', () => {
    expect(parseCitations([{ source, endIndex: 4, citedText: 'a whole record' }])).toEqual([{ source, endIndex: 4 }]);
  });
});

describe('approvalRequestIdOf', () => {
  const row = (id: string, batchId?: string): ChatToolPart => ({
    type: 'dynamic-tool',
    toolName: 'run',
    toolCallId: id,
    state: 'approval-requested',
    input: {},
    approval: { id, ...(batchId ? { descriptor: { batchId } } : {}) },
  });
  const messages: ChatMessage[] = [
    { id: 'a1', role: 'assistant', parts: [row('single')] },
    { id: 'a2', role: 'assistant', parts: [row('x1', 'batch-1'), row('x2', 'batch-1')] },
  ];

  it("a row of a batch answers by the batch's id", () => {
    expect(approvalRequestIdOf(messages, 'x2')).toBe('batch-1');
  });

  it('a row in no batch is its own request, and so is an id no card holds', () => {
    expect(approvalRequestIdOf(messages, 'single')).toBe('single');
    expect(approvalRequestIdOf(messages, 'batch-1')).toBe('batch-1');
  });
});
