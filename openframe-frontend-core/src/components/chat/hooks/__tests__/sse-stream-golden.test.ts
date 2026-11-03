/**
 * GOLDEN CHARACTERIZATION: what `useSseChatAdapter` holds after a response, driven through the full public hook.
 *
 * Two wires reach it. The standard's (`data: <chunk>` events, ending `data: [DONE]`), and until the cleanup the old hub's
 * (TODO(CU-17tkuw635xx)):
 *   [JSON frame]\0 [JSON frame]\0 …  \x1E  <raw UTF-8 answer deltas>  \x1F [JSON usage trailer]
 *
 * Each fixture feeds a mocked global fetch whose Response body is a ReadableStream of Uint8Array chunks, then snapshots the
 * resulting message state. Behaviors captured here, INCLUDING the sentinel-byte mis-framing in fixture (d), are the recorded
 * baseline. Do NOT "fix" them here.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  approvalAnswerInFlight,
  approvalBatchIdOf,
  approvalStatusOf,
  isSourcePart,
  isToolPart,
  textOfParts,
  type ChatMessage,
} from '../../../../chat-protocol/chat-message';
import { encodeUiChunk, encodeUiDone, STREAM_CLOSE_GRACE_MS, type UiChunk } from '../../../../chat-protocol/ui-chunks';
import {
  ANSWER_STREAM,
  APPROVAL_BATCH_STREAM,
  APPROVAL_REFUSED_STREAM,
  APPROVAL_REJECT_STREAM,
  APPROVAL_REQUEST_BODY,
  APPROVAL_RESPONSE_STREAM,
  APPROVAL_STREAM,
  FIXTURE_ASSISTANT_ID,
  FIXTURE_CONVERSATION_ID,
  FIXTURE_PROPOSAL_ID,
} from '../../../../chat-protocol/wire-fixtures';
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context';
import { approvalBatchViewOf } from '../../utils/tool-part-display';
import { APPROVAL_REFUSED, useSseChatAdapter } from '../use-sse-chat-adapter';

// =============================================================================
// Harness
// =============================================================================

const SOURCE = 'goldensrc';

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    approvalToolUrl: '/api/chat/agent/confirm-tool',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
  source: SOURCE,
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ChatRuntimeContext.Provider, { value: runtime }, children),
  );
}

/** renderHook with the required runtime + react-query providers.
 *  `active: false` skips the slash-command registry fetch so the mocked
 *  fetch only ever serves the chat stream. */
function renderAdapter() {
  return renderHook(() => useSseChatAdapter(undefined, { active: false }), { wrapper });
}

const enc = new TextEncoder();

/** Build a ReadableStream that enqueues each chunk (string → UTF-8) then closes. */
function streamOf(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(typeof c === 'string' ? enc.encode(c) : c);
      }
      controller.close();
    },
  });
}

/** Mock global fetch to serve ONE streamed chat response. */
function mockFetchStream(chunks: Array<string | Uint8Array>) {
  const fetchMock = vi.fn(() => {
    const body = streamOf(chunks);
    // Deliberately IGNORES the caller's AbortSignal — this mock serves a
    // stream that always runs to completion. The abort case has its own
    // signal-honouring mock inline in test (f) below.
    // Explicit promise (not `async`): building the stream is synchronous, but
    // `fetch` must stay promise-returning for the adapter's await path.
    return Promise.resolve({ ok: true, status: 200, body } as unknown as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const tick = () => new Promise<void>(r => setTimeout(r, 0));

beforeEach(() => {
  window.localStorage.clear();
  // Deterministic ids (`user-<now>-<random>`) and times.
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.useFakeTimers({ toFake: ['Date'], now: 1_700_000_000_000 });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Compact projection of the adapter's public state for snapshots. */
function snapshotState(result: { current: ReturnType<typeof useSseChatAdapter> }) {
  const s = result.current;
  return {
    messages: s.messages,
    streamingPhase: s.streamingPhase,
    provider: s.currentProvider,
    modelLabel: s.currentModelLabel,
    contextWindowMaxTokens: s.currentContextWindowMaxTokens,
    inputTokens: s.currentInputTokens,
    outputTokens: s.currentOutputTokens,
    cacheHitRatePct: s.currentCacheHitRatePct,
    usageBreakdown: s.currentUsageBreakdown,
  };
}

// Shared leading-frame fixtures (recorded wire shapes).
const THINKING_STATUS = '{"status":"thinking"}\0';
const THINKING_DELTA_1 = '{"kind":"thinking-delta","text":"Let me check the docs… "}\0';
const THINKING_DELTA_2 = '{"kind":"thinking-delta","text":"found it."}\0';
const METADATA_FRAME =
  '{"sources":[{"index":1,"name":"Pricing overview","path":"docs/pricing.md","documentType":"markdown","sourceRepo":"markdown"}],"model":"claude-sonnet-x","modelLabel":"Claude Sonnet","provider":"anthropic","contextWindowMaxTokens":200000}\0';
const ROUTING_FRAME = '{"kind":"routing","routedComplexity":"simple","routedThinkingBudget":0}\0';
const USAGE_START_FRAME = '{"kind":"usage","stage":"start","input_tokens":1234}\0';
const USAGE_END_TRAILER =
  '{"kind":"usage","stage":"end","input_tokens":1234,"output_tokens":56,"hit_rate_pct":81.5,"breakdown":{"haikuRewriter":{"input":10,"output":4},"haikuClassifier":{"input":8,"output":1},"routedAnswer":{"model":"claude-sonnet-x","complexity":"simple","thinkingBudget":0}}}';

const sourceTitles = (message: ChatMessage) => message.parts.filter(isSourcePart).map(source => source.title);
const assistantsOf = (messages: readonly ChatMessage[]) => messages.filter(message => message.role === 'assistant');

/** A stream's bytes on the standard's wire. */
const onUiWire = (chunks: readonly UiChunk[]): Uint8Array[] => [...chunks.map(encodeUiChunk), encodeUiDone()];

/** Serves one response per request, in order, and records each request. */
function mockFetchResponses(responses: Array<Array<string | Uint8Array> | { status: number; body: unknown }>) {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const pending = [...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      requests.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      const next = pending.shift() ?? [];
      if (!Array.isArray(next)) {
        return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status }));
      }
      return Promise.resolve({ ok: true, status: 200, body: streamOf(next) } as unknown as Response);
    }),
  );
  return requests;
}

describe('a live message shows the sources of the stream that drew it', () => {
  const sourcesFrame = (name: string) =>
    `{"sources":[{"index":1,"name":"${name}","path":"docs/${name}.md","documentType":"markdown"}]}\0`;
  const turn = (name: string | null, text: string, extra: string[] = []) => [
    ...(name ? [sourcesFrame(name)] : []),
    ...extra,
    '\x1E',
    text,
    '\x1F' + USAGE_END_TRAILER,
  ];
  const CARD_FRAME = '{"kind":"approval_request","proposalId":"p1","toolName":"create_task","title":"Create task"}\0';

  it('an approval continues the message of its card: it shifts no later answer and its receipt repeats no strip', async () => {
    let now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
    mockFetchResponses([
      turn('first', 'Proposal.', [CARD_FRAME]),
      turn(null, 'Task created.'),
      turn('second', 'Answer two.'),
      turn('third', 'Answer three.'),
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('create a task');
    });
    await act(async () => {
      await result.current.actions.approve?.('p1');
    });
    await act(async () => {
      await result.current.sendMessage('question two');
    });
    await act(async () => {
      await result.current.sendMessage('question three');
    });
    const answers = assistantsOf(result.current.messages);
    expect(answers.map(sourceTitles)).toEqual([['first'], ['second'], ['third']]);
    expect(textOfParts(answers[0].parts)).toContain('Task created.');
  });
});

describe('the standard wire', () => {
  it('a whole answer: sources lead, then text and cards in stream order, and the metadata reaches the state', async () => {
    mockFetchStream(onUiWire(ANSWER_STREAM));
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('what is the pricing?');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('survives a split at any byte', async () => {
    const bytes = Uint8Array.from(onUiWire(ANSWER_STREAM).flatMap(chunk => Array.from(chunk)));
    const partsFrom = async (chunks: Uint8Array[]) => {
      mockFetchStream(chunks);
      const { result, unmount } = renderAdapter();
      await act(async () => {
        await result.current.sendMessage('q');
      });
      const { parts } = assistantsOf(result.current.messages)[0];
      unmount();
      return parts;
    };
    const expected = await partsFrom([bytes]);
    expect(expected.length).toBeGreaterThan(0);
    expect(await partsFrom(Array.from({ length: bytes.length }, (_, i) => bytes.slice(i, i + 1)))).toEqual(expected);
  });

  it('a send states the standard’s request, and what an older hub still reads beside it', async () => {
    const requests = mockFetchResponses([onUiWire(ANSWER_STREAM), onUiWire(ANSWER_STREAM)]);
    const { result } = renderAdapter();
    const attachment = {
      fileName: 'a.png',
      contentType: 'image/png',
      storagePath: 'u/a.png',
      viewToken: 't',
      fileSize: 1,
    };
    await act(async () => {
      await result.current.sendMessage('look', { attachments: [attachment] } as never);
    });
    await act(async () => {
      await result.current.sendMessage('again');
    });

    const [first, second] = requests;
    expect(first.url).toBe('/api/docs/chat');
    expect(first.body.id).toEqual(expect.stringMatching(/^chat-/));
    expect(first.body).not.toHaveProperty('conversationId');
    expect(first.body.pendingAttachments).toEqual([attachment]);
    expect(first.body.messages).toEqual([
      {
        id: expect.stringMatching(/^user-/) as string,
        role: 'user',
        parts: [
          { type: 'text', text: 'look' },
          {
            type: 'file',
            mediaType: 'image/png',
            filename: 'a.png',
            url: '/api/storage/view/chat-attachments/u/a.png?t=t',
          },
        ],
        content: expect.stringContaining('look') as string,
      },
    ]);
    // Every later send names the conversation the server minted, with the newest message only.
    expect(second.body.id).toBe(FIXTURE_CONVERSATION_ID);
    expect(second.body.conversationId).toBe(FIXTURE_CONVERSATION_ID);
    expect((second.body.messages as unknown[]).length).toBe(1);
  });

  it('a user bubble holds its attachments as file parts', async () => {
    mockFetchStream(onUiWire(ANSWER_STREAM));
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('look', {
        attachments: [
          { fileName: 'a.png', contentType: 'image/png', storagePath: 'u/a.png', viewToken: 't', fileSize: 1 },
        ],
      } as never);
    });
    expect(result.current.messages[0].parts.map(part => part.type)).toEqual(['text', 'file']);
    // The bubble's text is what was typed: no attachment markdown.
    expect(textOfParts(result.current.messages[0].parts)).toBe('look');
  });
});

describe('the approval round trip', () => {
  const lastMessage = (result: { current: ReturnType<typeof useSseChatAdapter> }) =>
    result.current.messages[result.current.messages.length - 1];
  const rows = (message: ChatMessage) => message.parts.filter(isToolPart);

  async function withCard(responses: Array<Array<string | Uint8Array> | { status: number; body: unknown }>) {
    const requests = mockFetchResponses([onUiWire(APPROVAL_STREAM), ...responses]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    return { requests, result };
  }

  it('the card waits on the user, with the composer free', async () => {
    const { result } = await withCard([]);
    expect(rows(lastMessage(result)).map(approvalStatusOf)).toEqual(['pending']);
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('approving posts the card’s message to the chat endpoint, and the answer continues that message', async () => {
    const { requests, result } = await withCard([onUiWire(APPROVAL_RESPONSE_STREAM)]);
    const countBefore = result.current.messages.length;
    await act(async () => {
      await result.current.actions.approve?.(FIXTURE_PROPOSAL_ID);
    });

    const [, approval] = requests;
    expect(approval.url).toBe('/api/docs/chat');
    expect(approval.body).toEqual(APPROVAL_REQUEST_BODY);

    expect(result.current.messages).toHaveLength(countBefore);
    const message = lastMessage(result);
    expect(message.id).toBe(FIXTURE_ASSISTANT_ID);
    expect(rows(message)[0]).toMatchObject({ state: 'output-available', approval: { approved: true } });
    expect(textOfParts(message.parts)).toContain('Ticket closed.');
    expect(message.parts.map(part => part.type)).toContain('data-record-cards');
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('rejecting says so in the request, and the card is denied', async () => {
    const { requests, result } = await withCard([onUiWire(APPROVAL_REJECT_STREAM)]);
    await act(async () => {
      await result.current.actions.reject?.(FIXTURE_PROPOSAL_ID, 'not now');
    });
    const sent = (requests[1].body.messages as ChatMessage[])[0].parts[0];
    expect(sent).toMatchObject({ approval: { id: FIXTURE_PROPOSAL_ID, approved: false, reason: 'not now' } });
    expect(rows(lastMessage(result))[0].state).toBe('output-denied');
    expect(rows(lastMessage(result)).map(approvalStatusOf)).toEqual(['rejected']);
  });

  it('a refusal in the stream is an error on its row', async () => {
    const { result } = await withCard([onUiWire(APPROVAL_REFUSED_STREAM)]);
    await act(async () => {
      await result.current.actions.approve?.(FIXTURE_PROPOSAL_ID);
    });
    expect(rows(lastMessage(result))[0]).toMatchObject({
      state: 'output-error',
      errorText: 'This approval expired, ask again to get a fresh one.',
    });
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('a request refused outright fails the row with the server’s words, and leaves no loader', async () => {
    const { result } = await withCard([{ status: 409, body: { error: 'This approval expired.', code: 'STALE' } }]);
    await act(async () => {
      await expect(result.current.actions.approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    expect(rows(lastMessage(result))[0]).toMatchObject({ state: 'output-error', errorText: 'This approval expired.' });
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('a batch is answered whole by any of its ids, one request, every row in it', async () => {
    const requests = mockFetchResponses([
      onUiWire(APPROVAL_BATCH_STREAM),
      onUiWire([
        { type: 'start' },
        { type: 'tool-output-available', toolCallId: 'prop-a', dynamic: true, output: { ok: true } },
        { type: 'tool-output-error', toolCallId: 'prop-b', dynamic: true, errorText: 'Gone.' },
        { type: 'finish', finishReason: 'stop' },
      ]),
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('delete both');
    });
    expect(rows(lastMessage(result)).map(approvalBatchIdOf)).toEqual(['batch:prop-a', 'batch:prop-a']);

    await act(async () => {
      await result.current.actions.approve?.('batch:prop-a');
    });
    expect(requests).toHaveLength(2);
    const sent = (requests[1].body.messages as ChatMessage[])[0].parts;
    expect(sent.map(part => (isToolPart(part) ? [part.toolCallId, part.state] : null))).toEqual([
      ['prop-a', 'approval-responded'],
      ['prop-b', 'approval-responded'],
    ]);
    expect(rows(lastMessage(result)).map(part => part.state)).toEqual(['output-available', 'output-error']);
  });

  it('an id naming no pending card sends nothing', async () => {
    const { requests, result } = await withCard([]);
    await act(async () => {
      await expect(result.current.actions.approve?.('nobody')).resolves.toBe(false);
    });
    expect(requests).toHaveLength(1);
  });

  it('the old hub still answers an approval on its own route, one proposal per request', async () => {
    const batch =
      '{"kind":"approval_batch","batchId":"b1","proposals":[{"proposalId":"p1","toolName":"x","title":"X"},{"proposalId":"p2","toolName":"x","title":"Y"}]}\0';
    const decided = (id: string) =>
      `{"kind":"decision_resolved","proposalId":"${id}","ok":true,"action":"approved","willAutoContinue":false,"receiptText":"Done ${id}."}\0`;
    const requests = mockFetchResponses([[batch], [decided('p1'), '\x1E'], [decided('p2'), '\x1E']]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('do both');
    });
    await act(async () => {
      await result.current.actions.approve?.('b1');
    });
    expect(requests.slice(1).map(request => [request.url, request.body.proposal_id])).toEqual([
      ['/api/chat/agent/confirm-tool', 'p1'],
      ['/api/chat/agent/confirm-tool', 'p2'],
    ]);
    expect(assistantsOf(result.current.messages)).toHaveLength(1);
    expect(rows(lastMessage(result)).map(approvalStatusOf)).toEqual(['approved', 'approved']);
  });
});

describe('an approval whose answer never came', () => {
  const outcomeUnknown: unknown = expect.stringMatching(/may or may not have gone through/);
  const toolsOf = (messages: readonly ChatMessage[]) => messages.flatMap(message => message.parts).filter(isToolPart);
  const statesOf = (messages: readonly ChatMessage[]) => toolsOf(messages).map(part => part.state);

  /** The first response and then a body that stays open, or fails its next read, on the test's say. */
  function holdSecondResponse(first: readonly UiChunk[], head: readonly UiChunk[], how: 'error' | 'close' | 'hang') {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({ ok: true, status: 200, body: streamOf(onUiWire(first)) } as unknown as Response),
        )
        .mockImplementationOnce((_url: string, init?: RequestInit) => {
          let at = 0;
          const encoded = head.map(encodeUiChunk);
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              init?.signal?.addEventListener('abort', () => {
                try {
                  controller.error(new DOMException('The operation was aborted.', 'AbortError'));
                } catch {
                  /* already closed */
                }
              });
            },
            pull(controller) {
              if (at < encoded.length) controller.enqueue(encoded[at++]);
              else if (how === 'error') controller.error(new TypeError('network error'));
              else if (how === 'close') controller.close();
              else return new Promise<void>(() => {});
            },
          });
          return Promise.resolve({ ok: true, status: 200, body } as unknown as Response);
        }),
    );
  }

  const BATCH_ID = 'batch:prop-a';

  it.each(['error', 'close'] as const)(
    'a cut stream (%s) says nobody knows, on every row it left waiting',
    async how => {
      holdSecondResponse(APPROVAL_BATCH_STREAM, [{ type: 'start' }], how);
      const { result } = renderAdapter();
      await act(async () => {
        await result.current.sendMessage('delete both');
      });
      await act(async () => {
        await expect(result.current.actions.approve?.(BATCH_ID)).resolves.toBe(false);
      });
      const [first, second] = toolsOf(result.current.messages);
      expect([first.state, second.state]).toEqual(['output-error', 'output-error']);
      expect(first).toMatchObject({ errorText: outcomeUnknown, approval: { approved: true } });
      expect([first, second].map(approvalStatusOf)).toEqual(['unknown', 'unknown']);
      const view = approvalBatchViewOf([first, second]);
      expect(view.status).toBe('unknown');
      // No cross and no check: a cross would say the write failed, and it may have gone through.
      expect(
        Object.values(view.data.executions ?? {}).map(row => [row.status, row.success, row.outcomeUnknown]),
      ).toEqual([
        ['done', undefined, true],
        ['done', undefined, true],
      ]);
      expect(result.current.streamingPhase).toBe('idle');
    },
  );

  it('a row the stream did answer keeps its answer', async () => {
    holdSecondResponse(
      APPROVAL_BATCH_STREAM,
      [{ type: 'start' }, { type: 'tool-output-available', toolCallId: 'prop-a', dynamic: true, output: { ok: true } }],
      'error',
    );
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('delete both');
    });
    await act(async () => {
      await expect(result.current.actions.approve?.(BATCH_ID)).resolves.toBe(false);
    });
    expect(statesOf(result.current.messages)).toEqual(['output-available', 'output-error']);
    expect(toolsOf(result.current.messages)[1]).toMatchObject({ errorText: outcomeUnknown });
  });

  it('a single card says so too', async () => {
    holdSecondResponse(APPROVAL_STREAM, [{ type: 'start' }], 'close');
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    await act(async () => {
      await expect(result.current.actions.approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    expect(toolsOf(result.current.messages)[0]).toMatchObject({
      state: 'output-error',
      errorText: outcomeUnknown,
    });
    expect(approvalStatusOf(toolsOf(result.current.messages)[0])).toBe('unknown');
  });

  it('a refusal is known: nothing ran, and it says Failed with the server`s words', async () => {
    mockFetchResponses([
      onUiWire(APPROVAL_STREAM),
      { status: 409, body: { error: 'This approval expired.', code: 'STALE' } },
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    await act(async () => {
      await expect(result.current.actions.approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    const [part] = toolsOf(result.current.messages);
    expect(part).toMatchObject({ state: 'output-error', errorText: 'This approval expired.' });
    expect(approvalStatusOf(part)).toBe('failed');
  });

  it('a refusal with no words of its own, a gateway`s page say, is told to a person', async () => {
    const answers = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, status: 200, body: streamOf(onUiWire(APPROVAL_STREAM)) } as unknown as Response),
      )
      .mockImplementationOnce(() =>
        Promise.resolve(
          new Response('<html>403 Forbidden</html>', { status: 403, headers: { 'content-type': 'text/html' } }),
        ),
      );
    vi.stubGlobal('fetch', answers);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    await act(async () => {
      await expect(result.current.actions.approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    const [part] = toolsOf(result.current.messages);
    expect(part).toMatchObject({ state: 'output-error', errorText: APPROVAL_REFUSED });
    expect(APPROVAL_REFUSED).toBe('The server refused this, so it did not run.');
    expect(approvalStatusOf(part)).toBe('failed');
  });

  it('a 5xx may be a gateway`s word about a write still running: nobody knows', async () => {
    mockFetchResponses([onUiWire(APPROVAL_STREAM), { status: 504, body: { error: 'Gateway timeout' } }]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    await act(async () => {
      await expect(result.current.actions.approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    const [part] = toolsOf(result.current.messages);
    expect(part).toMatchObject({ state: 'output-error', errorText: outcomeUnknown });
    expect(approvalStatusOf(part)).toBe('unknown');
  });

  it('a request that never got an answer: nobody knows either', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({ ok: true, status: 200, body: streamOf(onUiWire(APPROVAL_STREAM)) } as unknown as Response),
        )
        .mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    await act(async () => {
      await expect(result.current.actions.approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    expect(approvalStatusOf(toolsOf(result.current.messages)[0])).toBe('unknown');
  });

  describe('while the answer is on its way', () => {
    const REFUSED = 'This approval expired, ask again to get a fresh one.';
    const oneCard = () => holdSecondResponse(APPROVAL_STREAM, [{ type: 'start' }], 'hang');
    const statusesOf = (messages: readonly ChatMessage[]) => toolsOf(messages).map(approvalStatusOf);

    /** The click and the request it sends, with its answer held back until Stop. */
    async function clicked(answer: () => unknown) {
      let answering: unknown;
      await act(async () => {
        answering = answer();
        await tick();
        await tick();
      });
      return { settle: () => answering };
    }

    it('an approved card says Approving, sends no marker, and Approved only once it ran', async () => {
      const requests = mockFetchResponses([
        onUiWire(APPROVAL_STREAM),
        onUiWire([
          { type: 'start' },
          { type: 'tool-output-available', toolCallId: FIXTURE_PROPOSAL_ID, dynamic: true, output: { ok: true } },
          { type: 'finish', finishReason: 'stop' },
        ]),
      ]);
      const { result } = renderAdapter();
      await act(async () => {
        await result.current.sendMessage('close it');
      });
      await act(async () => {
        await result.current.actions.approve?.(FIXTURE_PROPOSAL_ID);
      });
      expect(statusesOf(result.current.messages)).toEqual(['approved']);
      // What goes back is the standard's part: the marker is this client's own.
      expect(JSON.stringify(requests[1].body)).not.toContain('answerSent');
    });

    it('holds Approving for as long as the server says nothing', async () => {
      oneCard();
      const { result } = renderAdapter();
      await act(async () => {
        await result.current.sendMessage('close it');
      });
      const answer = await clicked(() => result.current.actions.approve?.(FIXTURE_PROPOSAL_ID));
      expect(statusesOf(result.current.messages)).toEqual(['approving']);
      expect(approvalAnswerInFlight(toolsOf(result.current.messages)[0])).toBe(true);
      act(() => {
        result.current.stopMessage();
      });
      await act(async () => {
        await answer.settle();
      });
      expect(statusesOf(result.current.messages)).toEqual(['unknown']);
    });

    it('a rejection reads Rejected at once, with its answer still on its way', async () => {
      oneCard();
      const { result } = renderAdapter();
      await act(async () => {
        await result.current.sendMessage('close it');
      });
      const answer = await clicked(() => result.current.actions.reject?.(FIXTURE_PROPOSAL_ID, 'not now'));
      expect(statusesOf(result.current.messages)).toEqual(['rejected']);
      expect(approvalAnswerInFlight(toolsOf(result.current.messages)[0])).toBe(true);
      act(() => {
        result.current.stopMessage();
      });
      await act(async () => {
        await answer.settle();
      });
      expect(statusesOf(result.current.messages)).toEqual(['rejected']);
      expect(approvalAnswerInFlight(toolsOf(result.current.messages)[0])).toBe(false);
    });

    it('every step of a refused batch is Approving, then Failed: never Approved', async () => {
      holdSecondResponse(
        APPROVAL_BATCH_STREAM,
        [
          { type: 'start' },
          { type: 'tool-output-error', toolCallId: 'prop-a', dynamic: true, errorText: REFUSED },
          { type: 'tool-output-error', toolCallId: 'prop-b', dynamic: true, errorText: REFUSED },
          { type: 'finish', finishReason: 'stop' },
        ],
        'close',
      );
      // Every render, not only what an act leaves behind: a card that says Approved for one frame has said it.
      const seen = new Set<string>();
      const { result } = renderHook(
        () => {
          const state = useSseChatAdapter(undefined, { active: false });
          const rows = toolsOf(state.messages);
          if (rows.length > 0) seen.add(approvalBatchViewOf(rows).status);
          return state;
        },
        { wrapper },
      );
      await act(async () => {
        await result.current.sendMessage('delete both');
      });
      // From the click on: while the card streamed in, a row has no gate to read yet.
      seen.clear();
      await act(async () => {
        await result.current.actions.approve?.(BATCH_ID);
      });
      expect(seen.has('approving')).toBe(true);
      expect(seen.has('approved')).toBe(false);
      expect(approvalBatchViewOf(toolsOf(result.current.messages)).status).toBe('failed');
    });

    it('a cut leaves no row Approving', async () => {
      holdSecondResponse(APPROVAL_STREAM, [{ type: 'start' }], 'error');
      const { result } = renderAdapter();
      await act(async () => {
        await result.current.sendMessage('close it');
      });
      await act(async () => {
        await expect(result.current.actions.approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
      });
      expect(statusesOf(result.current.messages)).toEqual(['unknown']);
      expect(approvalAnswerInFlight(toolsOf(result.current.messages)[0])).toBe(false);
    });
  });

  it('Stop leaves no row waiting', async () => {
    holdSecondResponse(APPROVAL_BATCH_STREAM, [{ type: 'start' }], 'hang');
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('delete both');
    });
    let answering: unknown;
    await act(async () => {
      answering = result.current.actions.approve?.(BATCH_ID);
      await tick();
      await tick();
    });
    expect(statesOf(result.current.messages)).toEqual(['approval-responded', 'approval-responded']);
    act(() => {
      result.current.stopMessage();
    });
    await act(async () => {
      await expect(answering).resolves.toBe(false);
    });
    expect(statesOf(result.current.messages)).toEqual(['output-error', 'output-error']);
    expect(toolsOf(result.current.messages).map(approvalStatusOf)).toEqual(['unknown', 'unknown']);
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('a rejection whose answer never came is still a rejection', async () => {
    holdSecondResponse(APPROVAL_STREAM, [{ type: 'start' }], 'error');
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    await act(async () => {
      await result.current.actions.reject?.(FIXTURE_PROPOSAL_ID, 'not now');
    });
    const [part] = toolsOf(result.current.messages);
    expect(approvalStatusOf(part)).toBe('rejected');
    expect(part).toMatchObject({ state: 'output-denied', approval: { approved: false, reason: 'not now' } });
  });

  it('a rejection the server refuses is still a rejection', async () => {
    mockFetchResponses([
      onUiWire(APPROVAL_STREAM),
      { status: 409, body: { error: 'This approval expired.', code: 'STALE' } },
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    await act(async () => {
      await result.current.actions.reject?.(FIXTURE_PROPOSAL_ID);
    });
    expect(toolsOf(result.current.messages).map(approvalStatusOf)).toEqual(['rejected']);
  });

  it('a batch rejected whole reads rejected, whichever row the server refused', async () => {
    mockFetchResponses([
      onUiWire(APPROVAL_BATCH_STREAM),
      onUiWire([
        { type: 'start' },
        { type: 'tool-output-denied', toolCallId: 'prop-a' },
        { type: 'tool-output-error', toolCallId: 'prop-b', dynamic: true, errorText: 'Expired.' },
        { type: 'finish', finishReason: 'stop' },
      ]),
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('delete both');
    });
    await act(async () => {
      await result.current.actions.reject?.(BATCH_ID);
    });
    const rows = toolsOf(result.current.messages);
    expect(rows.map(approvalStatusOf)).toEqual(['rejected', 'rejected']);
    expect(approvalBatchViewOf(rows).status).toBe('rejected');
  });

  it('on the old hub too: a body that closes with no decision fails the row it was asked about', async () => {
    const card = '{"kind":"approval_request","proposalId":"p1","toolName":"x","title":"X"}\0';
    mockFetchResponses([[card], []]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('do it');
    });
    await act(async () => {
      await expect(result.current.actions.approve?.('p1')).resolves.toBe(false);
    });
    expect(toolsOf(result.current.messages)[0]).toMatchObject({
      state: 'output-error',
      errorText: outcomeUnknown,
    });
  });
});

describe('an approval while another stream is open', () => {
  const toolsOf = (messages: readonly ChatMessage[]) => messages.flatMap(message => message.parts).filter(isToolPart);
  const textsOf = (messages: readonly ChatMessage[]) => assistantsOf(messages).map(m => textOfParts(m.parts));

  /** A response the test writes to, chunk by chunk. */
  function heldStream() {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    return {
      response: { ok: true, status: 200, body } as unknown as Response,
      write: async (...chunks: UiChunk[]) => {
        for (const chunk of chunks) controller?.enqueue(encodeUiChunk(chunk));
        await tick();
        await tick();
      },
      close: async () => {
        controller?.enqueue(encodeUiDone());
        controller?.close();
        await tick();
        await tick();
      },
    };
  }
  const SECOND_TURN: UiChunk[] = [
    { type: 'start', messageId: 'a2' },
    { type: 'text-start', id: 't2' },
    { type: 'text-delta', id: 't2', delta: 'FIRST-SENTENCE.' },
  ];

  it('an older card takes no answer from a running turn: its words stay in its message, and Stop reaches it', async () => {
    const second = heldStream();
    const answers = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({ ok: true, status: 200, body: streamOf(onUiWire(APPROVAL_STREAM)) } as unknown as Response),
      )
      .mockImplementationOnce(() => Promise.resolve(second.response));
    vi.stubGlobal('fetch', answers);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    const staleApprove = result.current.actions.approve;
    expect(staleApprove).toBeDefined();

    let turn: Promise<unknown> | undefined;
    await act(async () => {
      turn = result.current.sendMessage('what is new?');
      await second.write(...SECOND_TURN);
    });
    expect(result.current.actions.approve).toBeUndefined();
    expect(result.current.actions.reject).toBeUndefined();

    // The click that landed before a render could say so sends nothing, and moves nothing.
    await act(async () => {
      await expect(staleApprove?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    expect(answers).toHaveBeenCalledTimes(2);
    expect(approvalStatusOf(toolsOf(result.current.messages)[0])).toBe('pending');

    await act(async () => {
      await second.write(
        { type: 'text-delta', id: 't2', delta: ' SECOND-SENTENCE.' },
        { type: 'text-end', id: 't2' },
        { type: 'finish', finishReason: 'stop' },
      );
      await second.close();
      await turn;
    });
    expect(textsOf(result.current.messages)).toEqual(['I can close that ticket.', 'FIRST-SENTENCE. SECOND-SENTENCE.']);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.actions.approve).toBeDefined();
  });

  it('a card in the stream that proposed it waits for that stream to end, past its `finish`', async () => {
    const first = heldStream();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(first.response)),
    );
    const { result } = renderAdapter();
    let turn: Promise<unknown> | undefined;
    const proposal = APPROVAL_STREAM.filter(chunk => chunk.type !== 'finish');
    await act(async () => {
      turn = result.current.sendMessage('close it');
      await first.write(...proposal);
    });
    expect(approvalStatusOf(toolsOf(result.current.messages)[0])).toBe('pending');
    expect(result.current.actions.approve).toBeUndefined();

    // `finish` ends the phase before the reader has stopped. The chat still reads as loading, so the composer offers Stop
    // and no send it would have to refuse.
    await act(async () => {
      await first.write({ type: 'finish', finishReason: 'tool-calls' });
    });
    expect(result.current.streamingPhase).toBe('idle');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.actions.approve).toBeUndefined();

    await act(async () => {
      await first.close();
      await turn;
    });
    expect(result.current.actions.approve).toBeDefined();
  });

  describe('a send on top of it', () => {
    const POST_ONE = { type: 'blog_post', id: '1', title: 'Post 1', url: null };
    const RECEIPT: UiChunk[] = [
      { type: 'start' },
      { type: 'tool-output-available', toolCallId: FIXTURE_PROPOSAL_ID, dynamic: true, output: { ok: true } },
      { type: 'text-start', id: 'r' },
      { type: 'text-delta', id: 'r', delta: 'RECEIPT-WORDS.' },
      { type: 'text-end', id: 'r' },
    ];
    const userTexts = (messages: readonly ChatMessage[]) =>
      messages.filter(message => message.role === 'user').map(message => textOfParts(message.parts));

    /** A proposal, whole, then an answer that stays open; `signals` holds each request's abort signal. */
    async function answering() {
      const answer = heldStream();
      const signals: Array<AbortSignal | null | undefined> = [];
      const answers = vi
        .fn((_url: string, init?: RequestInit) => {
          signals.push(init?.signal);
          return Promise.resolve(answer.response);
        })
        .mockImplementationOnce((_url: string, init?: RequestInit) => {
          signals.push(init?.signal);
          return Promise.resolve({
            ok: true,
            status: 200,
            body: streamOf(onUiWire(APPROVAL_STREAM)),
          } as unknown as Response);
        });
      vi.stubGlobal('fetch', answers);
      const rendered = renderAdapter();
      await act(async () => {
        await rendered.result.current.sendMessage('close it');
      });
      let answered: unknown;
      await act(async () => {
        answered = rendered.result.current.actions.approve?.(FIXTURE_PROPOSAL_ID);
        await tick();
      });
      expect(answers).toHaveBeenCalledTimes(2);
      return { ...rendered, answer, answers, signals, answered: () => answered };
    }

    it('an Ask during an answer: one request, the receipt in the card`s message, and Stop reaches the answer', async () => {
      const { result, answer, answers, signals, answered } = await answering();

      act(() => {
        result.current.discussRef?.(POST_ONE);
      });
      await act(async () => {
        await tick();
      });
      expect(answers).toHaveBeenCalledTimes(2);
      expect(userTexts(result.current.messages)).toEqual(['close it']);

      await act(async () => {
        await answer.write(...RECEIPT);
      });
      expect(textsOf(result.current.messages)).toEqual(['I can close that ticket.\n\nRECEIPT-WORDS.']);
      expect(assistantsOf(result.current.messages)).toHaveLength(1);
      expect(result.current.writingMessageId).toBe(FIXTURE_ASSISTANT_ID);

      act(() => {
        result.current.stopMessage();
      });
      expect(signals[1]?.aborted).toBe(true);
      expect(result.current.isLoading).toBe(false);
      await act(async () => {
        await answer.close();
        await answered();
      });
    });

    it('a send during an answer resolves false and draws nothing', async () => {
      const { result, answer, answers, answered } = await answering();
      await act(async () => {
        await expect(result.current.sendMessage('and another thing')).resolves.toBe(false);
      });
      expect(answers).toHaveBeenCalledTimes(2);
      expect(userTexts(result.current.messages)).toEqual(['close it']);
      await act(async () => {
        await answer.write(...RECEIPT, { type: 'finish', finishReason: 'stop' });
        await answer.close();
        await answered();
      });
      // With the stream gone, the same send goes out.
      await act(async () => {
        await result.current.sendMessage('and another thing');
      });
      expect(answers).toHaveBeenCalledTimes(3);
    });

    it('a stream someone stopped holds nothing back, and does not end the turn after it', async () => {
      const { result, answer, answers, answered } = await answering();
      const next = heldStream();
      answers.mockImplementationOnce(() => Promise.resolve(next.response));
      let sent: Promise<unknown> | undefined;
      await act(async () => {
        // In one breath, before the stopped reader has stopped.
        result.current.stopMessage();
        sent = result.current.sendMessage('never mind that');
        await tick();
      });
      expect(answers).toHaveBeenCalledTimes(3);
      expect(userTexts(result.current.messages)).toEqual(['close it', 'never mind that']);

      await act(async () => {
        await answer.close();
        await answered();
        await tick();
      });
      expect(result.current.isLoading).toBe(true);
      expect(result.current.streamingPhase).not.toBe('idle');

      await act(async () => {
        await next.write(...SECOND_TURN, { type: 'text-end', id: 't2' }, { type: 'finish', finishReason: 'stop' });
        await next.close();
        await sent;
      });
      expect(result.current.isLoading).toBe(false);
      expect(textsOf(result.current.messages).slice(-1)).toEqual(['FIRST-SENTENCE.']);
    });
  });

  describe('a body that stays open past its end', () => {
    const graceOver = () => new Promise(resolve => setTimeout(resolve, STREAM_CLOSE_GRACE_MS + 50));

    /** A proposing turn written up to its end, its body left open. */
    async function stalled(...end: Array<UiChunk | 'done'>) {
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
      });
      const answers = vi.fn(() => Promise.resolve({ ok: true, status: 200, body } as unknown as Response));
      vi.stubGlobal('fetch', answers);
      const rendered = renderAdapter();
      let turn: Promise<unknown> | undefined;
      await act(async () => {
        turn = rendered.result.current.sendMessage('close it');
        await tick();
        for (const chunk of APPROVAL_STREAM.filter(c => c.type !== 'finish')) {
          controller?.enqueue(encodeUiChunk(chunk));
        }
        for (const item of end) controller?.enqueue(item === 'done' ? encodeUiDone() : encodeUiChunk(item));
        await tick();
        await tick();
      });
      return { ...rendered, answers, turn: () => turn };
    }
    const FINISH: UiChunk = { type: 'finish', finishReason: 'tool-calls' };

    it('`[DONE]` opens the card at once, whatever the transport does', async () => {
      const { result, turn } = await stalled(FINISH, 'done');
      await act(async () => {
        await turn();
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.actions.approve).toBeDefined();
    });

    it('`finish` with no `[DONE]`: Stop is on offer until the bound, then the stream closes and the card opens', async () => {
      const { result, answers, turn } = await stalled(FINISH);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.actions.approve).toBeUndefined();
      await act(async () => {
        await expect(result.current.sendMessage('in the gap')).resolves.toBe(false);
      });
      expect(answers).toHaveBeenCalledTimes(1);

      await act(async () => {
        await graceOver();
        await turn();
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.actions.approve).toBeDefined();
    });
  });

  it('keeps one action object for the length of a turn: the message memo compares it by reference', async () => {
    const first = heldStream();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(first.response)),
    );
    const { result } = renderAdapter();
    const idle = result.current.actions;
    let turn: Promise<unknown> | undefined;
    await act(async () => {
      turn = result.current.sendMessage('close it');
      await first.write({ type: 'start', messageId: 'a1' }, { type: 'text-start', id: 't1' });
    });
    const during = result.current.actions;
    expect(during).not.toBe(idle);
    await act(async () => {
      await first.write({ type: 'text-delta', id: 't1', delta: 'Hello' }, { type: 'text-end', id: 't1' });
    });
    expect(result.current.actions).toBe(during);
    await act(async () => {
      await first.write({ type: 'finish', finishReason: 'stop' });
      await first.close();
      await turn;
    });
    expect(result.current.actions).toBe(idle);
  });

  it('names the card`s message as the one written, for as long as its answer runs', async () => {
    const answer = heldStream();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({ ok: true, status: 200, body: streamOf(onUiWire(APPROVAL_STREAM)) } as unknown as Response),
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            body: streamOf(onUiWire([{ type: 'start', messageId: 'a2' }, ...ANSWER_STREAM.slice(1)])),
          } as unknown as Response),
        )
        .mockImplementationOnce(() => Promise.resolve(answer.response)),
    );
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    const card = assistantsOf(result.current.messages)[0].id;
    await act(async () => {
      await result.current.sendMessage('and what is new?');
    });
    expect(result.current.writingMessageId).toBeNull();
    expect(assistantsOf(result.current.messages)).toHaveLength(2);

    let answering: unknown;
    await act(async () => {
      answering = result.current.actions.approve?.(FIXTURE_PROPOSAL_ID);
      await tick();
    });
    expect(result.current.writingMessageId).toBe(card);
    // Past `finish` too, until the reader has stopped: named nowhere, the newer answer would read as being written.
    await act(async () => {
      await answer.write(
        { type: 'start' },
        { type: 'tool-output-available', toolCallId: FIXTURE_PROPOSAL_ID, dynamic: true, output: {} },
        { type: 'finish', finishReason: 'stop' },
      );
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.writingMessageId).toBe(card);
    await act(async () => {
      await answer.close();
      await answering;
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.writingMessageId).toBeNull();
  });

  it('a second click on a card already answered sends nothing', async () => {
    const answer = heldStream();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({ ok: true, status: 200, body: streamOf(onUiWire(APPROVAL_STREAM)) } as unknown as Response),
        )
        .mockImplementationOnce(() => Promise.resolve(answer.response)),
    );
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('close it');
    });
    const approve = result.current.actions.approve;
    let first: unknown;
    await act(async () => {
      first = approve?.(FIXTURE_PROPOSAL_ID);
      await tick();
    });
    expect(result.current.actions.approve).toBeUndefined();
    await act(async () => {
      await expect(approve?.(FIXTURE_PROPOSAL_ID)).resolves.toBe(false);
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      await answer.write(
        { type: 'start' },
        { type: 'tool-output-available', toolCallId: FIXTURE_PROPOSAL_ID, dynamic: true, output: {} },
        { type: 'finish', finishReason: 'stop' },
      );
      await answer.close();
      await first;
    });
    expect(approvalStatusOf(toolsOf(result.current.messages)[0])).toBe('approved');
  });
});

describe('the context a turn leaves', () => {
  const finishing = (usage: Record<string, number>): UiChunk[] => [
    { type: 'start', messageId: 'a1' },
    { type: 'text-delta', id: 't1', delta: 'Hello' },
    { type: 'finish', finishReason: 'stop', messageMetadata: { usage } },
  ];

  it('is the hub`s word for it, beside the sums the cost reads', async () => {
    mockFetchResponses([onUiWire(finishing({ inputTokens: 81_017, outputTokens: 500, contextTokens: 40_600 }))]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('hi');
    });
    expect(result.current.currentContextTokens).toBe(40_600);
    expect(result.current.currentInputTokens).toBe(81_017);
  });

  it('is unknown from an older hub', async () => {
    mockFetchResponses([onUiWire(finishing({ inputTokens: 12, outputTokens: 3 }))]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('hi');
    });
    expect(result.current.currentContextTokens).toBeNull();
  });
});

describe('a turn cut before any text', () => {
  const cutAfter = (chunks: readonly UiChunk[], how: 'error' | 'close'): ReadableStream<Uint8Array> => {
    const encoded = chunks.map(encodeUiChunk);
    let at = 0;
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (at < encoded.length) controller.enqueue(encoded[at++]);
        else if (how === 'error') controller.error(new TypeError('network error'));
        else controller.close();
      },
    });
  };
  const stage: UiChunk = {
    type: 'data-chat-progress',
    id: 't:searching',
    transient: true,
    data: { stage: 'searching', count: 2, state: 'running' },
  };

  it.each(['error', 'close'] as const)('(%s) keeps its row, says it was cut, and stops its stage', async how => {
    const body = cutAfter(
      [
        { type: 'start', messageId: 'a1' },
        { type: 'source-url', sourceId: 'record://blog_post/1', url: 'https://www.flamingo.run/blog/x', title: 'X' },
        stage,
      ],
      how,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, body } as unknown as Response)),
    );
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('q');
    });
    const answer = assistantsOf(result.current.messages)[0];
    expect(answer.metadata?.finishReason).toBe('interrupted');
    expect(answer.metadata?.progress?.map(row => row.state)).toEqual(['failed']);
    expect(result.current.streamingPhase).toBe('idle');
  });

  it.each(['error', 'close'] as const)('(%s) with nothing at all still has a row to say it on', async how => {
    const body = cutAfter([{ type: 'start', messageId: 'a1' }], how);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, body } as unknown as Response)),
    );
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('q');
    });
    expect(assistantsOf(result.current.messages)).toMatchObject([
      { parts: [], metadata: { finishReason: 'interrupted' } },
    ]);
  });

  it('a turn that ended cleanly with nothing to say leaves no row', async () => {
    mockFetchResponses([onUiWire([{ type: 'start' }, { type: 'finish', finishReason: 'stop' }])]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('q');
    });
    expect(assistantsOf(result.current.messages)).toEqual([]);
  });
});

describe('a new chat during a turn', () => {
  it('the rest of the old stream does not draw in the cleared thread', async () => {
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        ctrl = controller;
        controller.enqueue(encodeUiChunk({ type: 'start', messageId: 'a1' }));
        controller.enqueue(encodeUiChunk({ type: 'text-start', id: 't1' }));
        controller.enqueue(encodeUiChunk({ type: 'text-delta', id: 't1', delta: 'first ' }));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, body } as unknown as Response)),
    );
    const { result } = renderAdapter();
    let sending!: Promise<void | boolean>;
    await act(async () => {
      sending = result.current.sendMessage('q');
      await tick();
      await tick();
    });
    expect(result.current.messages.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.messages).toEqual([]);

    await act(async () => {
      // What was still on its way when the thread was cleared. This mock ignores the abort, as a slow network would.
      ctrl.enqueue(encodeUiChunk({ type: 'text-delta', id: 't1', delta: 'ghost' }));
      await sending;
      await tick();
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.streamingPhase).toBe('idle');
  });
});

describe('stop', () => {
  it('ends the turn where it is: what it said stays, marked aborted', async () => {
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c;
        c.enqueue(encodeUiChunk({ type: 'start', messageId: 'a1' }));
        c.enqueue(encodeUiChunk({ type: 'text-delta', id: 't1', delta: 'Partial' }));
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        init?.signal?.addEventListener('abort', () => {
          try {
            ctrl.error(new DOMException('The operation was aborted.', 'AbortError'));
          } catch {
            /* already closed */
          }
        });
        return Promise.resolve({ ok: true, status: 200, body } as unknown as Response);
      }),
    );
    const { result } = renderAdapter();
    let sending!: Promise<void | boolean>;
    act(() => {
      sending = result.current.sendMessage('will be stopped');
    });
    await act(async () => {
      await tick();
      await tick();
      await tick();
    });
    act(() => {
      result.current.stopMessage();
    });
    await act(async () => {
      await sending;
    });
    const answer = assistantsOf(result.current.messages)[0];
    expect(textOfParts(answer.parts)).toBe('Partial');
    expect(answer.parts[0]).toMatchObject({ state: 'done' });
    expect(answer.metadata?.aborted).toBe(true);
    expect(result.current.streamingPhase).toBe('idle');
  });
});

describe('a failed request', () => {
  it('states the server’s words on the turn, and the composer is free', async () => {
    mockFetchResponses([{ status: 503, body: { error: 'The server is busy.', code: 'UPSTREAM_BUSY' } }]);
    const { result } = renderAdapter();
    let ok: void | boolean = true;
    await act(async () => {
      ok = await result.current.sendMessage('q');
    });
    expect(ok).toBe(false);
    expect(assistantsOf(result.current.messages)[0].parts).toEqual([
      { type: 'data-error', data: { title: 'The server is busy.' } },
    ]);
    expect(result.current.streamingPhase).toBe('idle');
  });
});

// TODO(CU-17tkuw635xx): the old hub's wire. These go at the cleanup, with `old-wire.ts`.
describe('SSE wire decode — golden fixtures (full hook path)', () => {
  it('(a) normal turn: thinking frames → metadata → usage:start → \\x1E → text ×3 → \\x1F trailer', async () => {
    mockFetchStream([
      THINKING_STATUS,
      THINKING_DELTA_1,
      THINKING_DELTA_2,
      METADATA_FRAME,
      ROUTING_FRAME,
      USAGE_START_FRAME,
      '\x1E',
      'Answer part one, ',
      'part two, ',
      'part three.',
      '\x1F' + USAGE_END_TRAILER,
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('what is the pricing?');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('(b) EVERYTHING in one single TCP chunk', async () => {
    mockFetchStream([
      THINKING_STATUS +
        THINKING_DELTA_1 +
        METADATA_FRAME +
        USAGE_START_FRAME +
        '\x1E' +
        'One-chunk answer.' +
        '\x1F' +
        USAGE_END_TRAILER,
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('one chunk please');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('(c) trailer split across two chunks arriving with stream done', async () => {
    mockFetchStream([
      METADATA_FRAME,
      '\x1E',
      'Split-trailer answer.',
      '\x1F{"kind":"usage","stage":"end","input_to',
      'kens":42,"output_tokens":9,"hit_rate_pct":12.5}',
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('split the trailer');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('(d) answer text containing literal \\x1E/\\x1F/\\0 bytes', async () => {
    // CHARACTERIZATION: current behavior, see unification plan.
    //  - In text mode only \x1F is scanned: literal \0 and \x1E bytes in
    //    the answer pass through into the rendered text unchanged.
    //  - The FIRST literal \x1F flips the decoder into trailer mode:
    //    everything after it (including later real text) is captured as
    //    the trailer buffer, fails JSON.parse, and is SILENTLY DROPPED —
    //    the real \x1F usage trailer is lost too (mis-framing/truncation).
    mockFetchStream([
      METADATA_FRAME,
      '\x1E',
      'has-nul[\0]and-rs[\x1E]still-text. ',
      'now-us[\x1F]everything-after-is-swallowed',
      ' including this and the real trailer:',
      '\x1F' + USAGE_END_TRAILER,
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('sentinel bytes in answer');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('(e) [x](record://blog/x) marker in the answer; a legacy refs frame is ignored', async () => {
    // The refs data channel is GONE — cards hydrate by id from the marker.
    // An old server still emitting a refs-bearing metadata frame must be
    // harmless: the frame decodes as metadata-ish and contributes nothing.
    const refsFrame =
      '{"refs":{"blog:x":{"type":"blog","id":"x","title":"Post X","url":"/blog/x","metadata":{"slug":"post-x"}}}}\0';
    mockFetchStream([
      METADATA_FRAME,
      refsFrame,
      '\x1E',
      'See [x](record://blog/x) for the full story.',
      '\x1F' + USAGE_END_TRAILER,
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('show me the post');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('(f) abort mid-stream via AbortController leaves the partial message in place', async () => {
    // Manually-controlled stream: enqueue the leading frames + first text
    // delta, keep the stream OPEN, then Stop. The mocked fetch honors the
    // AbortSignal by erroring the stream with AbortError — same observable
    // behavior as real fetch cancelling the body.
    let ctrl!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c;
        c.enqueue(enc.encode(METADATA_FRAME));
        c.enqueue(enc.encode('\x1E'));
        c.enqueue(enc.encode('Partial ans'));
      },
    });
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => {
        try {
          ctrl.error(new DOMException('The operation was aborted.', 'AbortError'));
        } catch {
          /* already closed */
        }
      });
      return Promise.resolve({ ok: true, status: 200, body } as unknown as Response);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderAdapter();
    let sendPromise!: Promise<void | boolean>;
    act(() => {
      sendPromise = result.current.sendMessage('will be aborted');
    });
    // Let the decoder consume the enqueued chunks.
    await act(async () => {
      await tick();
      await tick();
      await tick();
    });
    act(() => {
      result.current.stopMessage();
    });
    await act(async () => {
      await sendPromise;
    });
    expect(snapshotState(result)).toMatchSnapshot();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('(g) multi-byte UTF-8 character split across two chunks decodes intact', async () => {
    // '🦩' = F0 9F A6 A9 — split 2+2 across chunk boundary. The decoder is
    // created once per stream with {stream:true} reads, so the glyph
    // survives the split. CHARACTERIZATION: current (correct) behavior.
    const flamingo = enc.encode('🦩');
    mockFetchStream([
      METADATA_FRAME,
      '\x1E',
      'A wild ',
      flamingo.slice(0, 2),
      flamingo.slice(2),
      ' appears',
      '\x1F' + USAGE_END_TRAILER,
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('emoji split');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('leading approval_request + text-leading frames yield a pending approval card', async () => {
    mockFetchStream([
      '{"kind":"text-leading","text":"I\'ll open a ticket for you."}\0',
      '{"kind":"approval_request","proposalId":"prop-1","toolName":"create_ticket","title":"Create ticket","fields":[{"label":"Subject","value":"Printer down"},{"label":"Priority","value":"High"},{"bad":"missing label/value"}]}\0',
      // Stream closes with NO \x1E answer body — the approval turn ends here.
    ]);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('open a ticket');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });

  it('non-JSON leading buffer falls through to answer text (legacy no-frame stream)', async () => {
    // CHARACTERIZATION: a frame-less response whose first \0-terminated
    // block is not JSON flips straight into text mode and the buffer is
    // emitted as answer text.
    mockFetchStream(['plain text answer with no frames\0and more after the nul']);
    const { result } = renderAdapter();
    await act(async () => {
      await result.current.sendMessage('legacy stream');
    });
    expect(snapshotState(result)).toMatchSnapshot();
  });
});
