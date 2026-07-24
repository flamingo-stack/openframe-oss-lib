/**
 * Phase-0 GOLDEN CHARACTERIZATION TESTS — the SSE wire decoder inside
 * `useSseChatAdapter` (`createDocStreamFn`), driven through the full
 * public hook (`useSseChatAdapter` → `useChat` → `useSSE`).
 *
 * Wire format (recorded from the hub's /api/docs/chat):
 *   [JSON frame]\0 [JSON frame]\0 …  \x1E  <raw UTF-8 answer deltas>  \x1F [JSON usage trailer]
 *
 * Each fixture feeds a mocked global fetch whose Response body is a
 * ReadableStream of Uint8Array chunks, then snapshots the resulting
 * message state. Behaviors captured here — INCLUDING the sentinel-byte
 * mis-framing in fixture (d) — are the recorded baseline for the
 * unification reducer. Do NOT "fix" them here.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSseChatAdapter } from '../use-sse-chat-adapter'
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context'

// =============================================================================
// Harness
// =============================================================================

const SOURCE = 'goldensrc'

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
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ChatRuntimeContext.Provider, { value: runtime }, children),
  )
}

/** renderHook with the required runtime + react-query providers.
 *  `active: false` skips the slash-command registry fetch so the mocked
 *  fetch only ever serves the chat stream. */
function renderAdapter() {
  return renderHook(() => useSseChatAdapter(undefined, { active: false }), { wrapper })
}

const enc = new TextEncoder()

/** Build a ReadableStream that enqueues each chunk (string → UTF-8) then closes. */
function streamOf(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(typeof c === 'string' ? enc.encode(c) : c)
      }
      controller.close()
    },
  })
}

/** Mock global fetch to serve ONE streamed chat response. */
function mockFetchStream(chunks: Array<string | Uint8Array>) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = streamOf(chunks)
    // Honor the caller's AbortSignal like real fetch: error the stream so
    // pending reader.read() calls reject with AbortError.
    return { ok: true, status: 200, body } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

beforeEach(() => {
  window.localStorage.clear()
  // Deterministic Date.now: message ids (`user-<now>`) and the 50ms
  // thinking-throttle both read it. With a frozen clock the FIRST
  // thinking delta yields immediately (now - 0 >= 50) and every later
  // delta within the same stream is throttled (now - last = 0 < 50) and
  // flushed at the \x1E boundary — fully deterministic.
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Compact projection of the adapter's public state for snapshots. */
function snapshotState(result: { current: ReturnType<typeof useSseChatAdapter> }) {
  const s = result.current
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
  }
}

// Shared leading-frame fixtures (recorded wire shapes).
const THINKING_STATUS = '{"status":"thinking"}\0'
const THINKING_DELTA_1 = '{"kind":"thinking-delta","text":"Let me check the docs… "}\0'
const THINKING_DELTA_2 = '{"kind":"thinking-delta","text":"found it."}\0'
const METADATA_FRAME =
  '{"sources":[{"index":1,"name":"Pricing overview","path":"docs/pricing.md","documentType":"markdown","sourceRepo":"markdown"}],"model":"claude-sonnet-x","modelLabel":"Claude Sonnet","provider":"anthropic","contextWindowMaxTokens":200000}\0'
const ROUTING_FRAME = '{"kind":"routing","routedComplexity":"simple","routedThinkingBudget":0}\0'
const USAGE_START_FRAME = '{"kind":"usage","stage":"start","input_tokens":1234}\0'
const USAGE_END_TRAILER =
  '{"kind":"usage","stage":"end","input_tokens":1234,"output_tokens":56,"hit_rate_pct":81.5,"breakdown":{"haikuRewriter":{"input":10,"output":4},"haikuClassifier":{"input":8,"output":1},"routedAnswer":{"model":"claude-sonnet-x","complexity":"simple","thinkingBudget":0}}}'

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
    ])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('what is the pricing?')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })

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
    ])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('one chunk please')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })

  it('(c) trailer split across two chunks arriving with stream done', async () => {
    mockFetchStream([
      METADATA_FRAME,
      '\x1E',
      'Split-trailer answer.',
      '\x1F{"kind":"usage","stage":"end","input_to',
      'kens":42,"output_tokens":9,"hit_rate_pct":12.5}',
    ])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('split the trailer')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })

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
    ])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('sentinel bytes in answer')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })

  it('(e) [card://blog:x] marker in the answer with refs metadata frame', async () => {
    const refsFrame =
      '{"refs":{"blog:x":{"type":"blog","id":"x","title":"Post X","url":"/blog/x","metadata":{"slug":"post-x"}}}}\0'
    mockFetchStream([
      METADATA_FRAME,
      refsFrame,
      '\x1E',
      'See [card://blog:x] for the full story.',
      '\x1F' + USAGE_END_TRAILER,
    ])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('show me the post')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })

  it('(f) abort mid-stream via AbortController leaves the partial message in place', async () => {
    // Manually-controlled stream: enqueue the leading frames + first text
    // delta, keep the stream OPEN, then Stop. The mocked fetch honors the
    // AbortSignal by erroring the stream with AbortError — same observable
    // behavior as real fetch cancelling the body.
    let ctrl!: ReadableStreamDefaultController<Uint8Array>
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c
        c.enqueue(enc.encode(METADATA_FRAME))
        c.enqueue(enc.encode('\x1E'))
        c.enqueue(enc.encode('Partial ans'))
      },
    })
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => {
        try {
          ctrl.error(new DOMException('The operation was aborted.', 'AbortError'))
        } catch {
          /* already closed */
        }
      })
      return { ok: true, status: 200, body } as unknown as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderAdapter()
    let sendPromise!: Promise<void>
    act(() => {
      sendPromise = result.current.sendMessage('will be aborted')
    })
    // Let the decoder consume the enqueued chunks.
    await act(async () => {
      await tick()
      await tick()
      await tick()
    })
    act(() => {
      result.current.stopMessage()
    })
    await act(async () => {
      await sendPromise
    })
    expect(snapshotState(result)).toMatchSnapshot()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('(g) multi-byte UTF-8 character split across two chunks decodes intact', async () => {
    // '🦩' = F0 9F A6 A9 — split 2+2 across chunk boundary. The decoder is
    // created once per stream with {stream:true} reads, so the glyph
    // survives the split. CHARACTERIZATION: current (correct) behavior.
    const flamingo = enc.encode('🦩')
    mockFetchStream([
      METADATA_FRAME,
      '\x1E',
      'A wild ',
      flamingo.slice(0, 2),
      flamingo.slice(2),
      ' appears',
      '\x1F' + USAGE_END_TRAILER,
    ])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('emoji split')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })

  it('leading approval_request + text-leading frames yield a pending approval card', async () => {
    mockFetchStream([
      '{"kind":"text-leading","text":"I\'ll open a ticket for you."}\0',
      '{"kind":"approval_request","proposalId":"prop-1","toolName":"create_ticket","title":"Create ticket","fields":[{"label":"Subject","value":"Printer down"},{"label":"Priority","value":"High"},{"bad":"missing label/value"}]}\0',
      // Stream closes with NO \x1E answer body — the approval turn ends here.
    ])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('open a ticket')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })

  it('non-JSON leading buffer falls through to answer text (legacy no-frame stream)', async () => {
    // CHARACTERIZATION: a frame-less response whose first \0-terminated
    // block is not JSON flips straight into text mode and the buffer is
    // emitted as answer text.
    mockFetchStream(['plain text answer with no frames\0and more after the nul'])
    const { result } = renderAdapter()
    await act(async () => {
      await result.current.sendMessage('legacy stream')
    })
    expect(snapshotState(result)).toMatchSnapshot()
  })
})
