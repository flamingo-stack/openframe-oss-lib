/**
 * Reconnect behaviour of the shared NATS connection, exercised end to end: the
 * real `NatsProvider`, the real `shared-connection` bookkeeping and the real
 * `nats.ws` client, against a fake gateway on a stubbed `WebSocket`.
 *
 * The scenarios are drawn from how the connection is actually driven in a
 * NATIVE SHELL, which is the harshest caller. There the bearer token is a
 * query param on the socket URL (`buildNatsWsUrl` with `includeAuthParam`), so
 * every token rotation changes the URL and forces a full teardown and rebuild
 * — on the web the URL is constant and a rotation is invisible here. The
 * gateway also closes every `/ws/nats*` session at JWT `exp + 60s`
 * (`WebSocketServiceSecurityDecorator`), so those rebuilds are guaranteed to
 * happen on the token clock rather than only when the network misbehaves.
 *
 * Several of these pin failures that were PERMANENT: no retry, no error, no
 * status event, the tail simply never came back and nothing said so.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acquireClient,
  getSharedConnectionFor,
  NATS_DEFAULTS,
  NatsProvider,
  type NatsStatus,
  releaseClient,
  startConnectionLifecycle,
  useNats,
} from '@/nats'

// ---------------------------------------------------------------------------
// Fake gateway
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const INFO =
  `INFO {"server_id":"FAKE","server_name":"FAKE","version":"2.10.0","proto":1,"go":"go1.21",` +
  `"host":"127.0.0.1","port":4222,"headers":true,"max_payload":1048576,"client_id":1,` +
  `"client_ip":"127.0.0.1"}\r\n`

/** Tokens the fake gateway currently accepts on the handshake. */
let validTokens = new Set<string>()
let sockets: FakeWebSocket[] = []
/** Unique per test: connections are cached by URL in module state. */
let host = 'h0'
/** Stop answering PING, which is what makes nats.ws raise `staleConnection`. */
let suppressPong = false

const WS_CONNECTING = 0
const WS_OPEN = 1
const WS_CLOSED = 3

function tokenOf(url: string): string {
  return new URL(url.replace(/^ws/, 'http')).searchParams.get('authorization') ?? ''
}

class FakeWebSocket
  implements Pick<WebSocket, 'url' | 'readyState' | 'binaryType' | 'bufferedAmount' | 'close' | 'send'>
{
  url: string
  readyState: number = WS_CONNECTING
  binaryType: BinaryType = 'blob'
  bufferedAmount = 0
  onopen: ((e?: unknown) => void) | null = null
  onmessage: ((e: { data: ArrayBuffer }) => void) | null = null
  onclose: ((e: { wasClean: boolean; code: number; reason: string }) => void) | null = null
  onerror: ((e: { message: string; error: Error }) => void) | null = null
  readonly accepted: boolean

  constructor(url: string) {
    this.url = url
    this.accepted = validTokens.has(tokenOf(url))
    sockets.push(this)
    setTimeout(() => {
      if (!this.accepted) {
        // A gateway that refuses the upgrade (expired/unknown bearer) looks
        // like this from the browser: error, then a non-clean close.
        this.readyState = WS_CLOSED
        this.onerror?.({ message: 'handshake refused', error: new Error('401') })
        this.onclose?.({ wasClean: false, code: 1006, reason: '' })
        return
      }
      this.readyState = WS_OPEN
      this.onopen?.()
      this.deliver(INFO)
    }, 0)
  }

  private deliver(frame: string) {
    const bytes = encoder.encode(frame)
    this.onmessage?.({
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    })
  }

  send(buf: string | ArrayBufferLike | Blob | ArrayBufferView) {
    const view = ArrayBuffer.isView(buf)
      ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      : new Uint8Array(buf as ArrayBufferLike)
    if (decoder.decode(view).includes('PING') && !suppressPong) {
      setTimeout(() => this.deliver('PONG\r\n'), 0)
    }
  }

  close(code?: number) {
    if (this.readyState === WS_CLOSED) return
    this.readyState = WS_CLOSED
    this.onclose?.({ wasClean: true, code: code ?? 1000, reason: '' })
  }

  /** The gateway retiring the session at JWT expiry. */
  serverClose() {
    this.close(1000)
  }

  get isOpen() {
    return this.readyState === WS_OPEN
  }
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

async function tick(ms = 0) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

function currentHost() {
  return `${host}.test`
}

/**
 * The one place the socket URL is spelled. It is what keys the module-level
 * connection registry, so a second copy drifting from this one would leave
 * `getSharedConnectionFor` matching nothing while the assertions still passed.
 */
function currentUrl(token: string) {
  return `ws://${currentHost()}/ws/nats-api?authorization=${token}`
}

/**
 * Scoped by host as well as by token: `beforeEach` bumps the host precisely so
 * that a connection cached from an earlier test cannot satisfy a later test's
 * assertion, and matching on the token alone would throw that isolation away.
 * Substring rather than equality against `currentUrl` because nats.ws hands the
 * WebSocket a normalised URL — the default port spelled out.
 */
function openSocketsFor(token: string) {
  return sockets.filter((s) => s.url.includes(currentHost()) && tokenOf(s.url) === token && s.isOpen)
}

const BACKOFF = { fastRetries: 3, fastRetryDelayMs: 200 } as const
const CLIENT = { name: 'openframe-frontend-app', user: 'machine', pass: '' } as const

/** How long a first connect may take, and how long a recovery may take. */
const READY_TIMEOUT = 6_000
const RECOVERY_TIMEOUT = 20_000
/**
 * Per-test budget. Has to dominate the waits inside the test, or vitest kills it
 * before the assertion it exists to bound gets its own timeout — the busiest
 * test here spends up to `READY_TIMEOUT * 2 + RECOVERY_TIMEOUT * 3`.
 */
const TEST_TIMEOUT = READY_TIMEOUT * 2 + RECOVERY_TIMEOUT * 3 + 10_000

interface ProviderState {
  status: NatsStatus
  ready: boolean
}

function Probe({ onState }: { onState: (s: ProviderState) => void }) {
  const { status, isReady } = useNats()
  React.useEffect(() => {
    onState({ status, ready: isReady })
  })
  return null
}

interface Controls {
  setToken: (t: string) => void
  setChatOpen: (v: boolean) => void
}

/**
 * Mirrors `NatsAppConfigProvider` + `NatsAppProvider`: the bearer lives in
 * React state, the URL is derived from it and `urlRevision` carries it, so a
 * rotation re-runs the provider's only effect.
 */
function App({
  controls,
  onBeforeReconnect,
  onProviderState,
  onChatState,
  chatOpenInitially = false,
  withChat = false,
}: {
  controls: Controls
  onBeforeReconnect: (setToken: (t: string) => void) => Promise<void>
  onProviderState: (s: ProviderState) => void
  onChatState?: (s: { connected: boolean }) => void
  chatOpenInitially?: boolean
  withChat?: boolean
}) {
  const [token, setToken] = React.useState('T1')
  const [chatOpen, setChatOpen] = React.useState(chatOpenInitially)
  React.useEffect(() => {
    controls.setToken = setToken
    controls.setChatOpen = setChatOpen
  }, [controls])

  const getWsUrl = React.useCallback(() => (token ? currentUrl(token) : null), [token])
  const before = React.useCallback(async () => {
    await onBeforeReconnect(setToken)
  }, [onBeforeReconnect])

  return (
    <NatsProvider
      getWsUrl={getWsUrl}
      onBeforeReconnect={before}
      clientConfig={CLIENT}
      reconnectionBackoff={BACKOFF}
      urlRevision={token}
    >
      <Probe onState={onProviderState} />
      {withChat && chatOpen ? (
        <ChatSurface getWsUrl={getWsUrl} onBeforeReconnect={before} onState={onChatState!} />
      ) : null}
    </NatsProvider>
  )
}

/**
 * Stands in for `useJetStreamDialogSubscription` / `useNatsDialogSubscription`:
 * resolves the URL during render, acquires the SHARED connection, runs its own
 * lifecycle and releases on cleanup, keyed on `[enabled, wsUrl]` like the real
 * hooks. It matters that this shares one connection with the provider — every
 * NATS surface resolves to the same `/ws/nats-api` URL.
 */
function ChatSurface({
  getWsUrl,
  onBeforeReconnect,
  onState,
}: {
  getWsUrl: () => string | null
  onBeforeReconnect: () => Promise<void>
  onState: (s: { connected: boolean }) => void
}) {
  const wsUrl = getWsUrl()
  const [connected, setConnected] = React.useState(false)
  const heldRef = React.useRef<string>('')
  const cbRef = React.useRef({ getWsUrl, onBeforeReconnect })
  React.useEffect(() => {
    cbRef.current = { getWsUrl, onBeforeReconnect }
  })

  React.useEffect(() => {
    if (!wsUrl) {
      if (heldRef.current) {
        releaseClient(heldRef.current)
        heldRef.current = ''
        setConnected(false)
      }
      return
    }
    heldRef.current = wsUrl
    const conn = acquireClient(wsUrl, CLIENT)
    setConnected(conn.client.isConnected())

    const lifecycle = startConnectionLifecycle({
      conn,
      wsUrl,
      onBeforeReconnect: () => cbRef.current.onBeforeReconnect(),
      backoff: BACKOFF,
      getFreshUrl: () => cbRef.current.getWsUrl(),
      onStatusChange: (status) => {
        if (status === 'connected') setConnected(true)
        if (status === 'closed' || status === 'disconnected') setConnected(false)
      },
    })

    return () => {
      lifecycle.stop()
      setConnected(false)
      if (heldRef.current) {
        releaseClient(heldRef.current)
        heldRef.current = ''
      }
    }
  }, [wsUrl])

  React.useEffect(() => {
    onState({ connected })
  })
  return null
}

let testIndex = 0

describe('shared NATS connection reconnect', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    host = `h${++testIndex}`
    validTokens = new Set(['T1'])
    sockets = []
    suppressPong = false
  })

  afterEach(() => {
    // Unmount BEFORE restoring the real WebSocket: a lifecycle left mounted
    // keeps its provider tree, its shared connection and any armed retry timer
    // alive into the next test, and a retry firing after the stub is gone would
    // dial jsdom's real WebSocket.
    cleanup()
    vi.unstubAllGlobals()
  })

  function boot(
    onBeforeReconnect: (setToken: (t: string) => void) => Promise<void>,
    opts: { withChat?: boolean; chatOpenInitially?: boolean } = {},
  ) {
    let provider: ProviderState = { status: 'closed', ready: false }
    let chat = { connected: false }
    const controls: Controls = {
      setToken: () => {},
      setChatOpen: () => {},
    }
    render(
      <App
        controls={controls}
        onBeforeReconnect={onBeforeReconnect}
        onProviderState={(s) => {
          provider = s
        }}
        onChatState={(s) => {
          chat = s
        }}
        withChat={opts.withChat}
        chatOpenInitially={opts.chatOpenInitially}
      />,
    )
    return {
      controls,
      get provider() {
        return provider
      },
      get chat() {
        return chat
      },
    }
  }

  const noRefresh = async () => {}

  /** What a 401 inside `onBeforeReconnect` does: rotate, and let the gateway follow. */
  const refreshToT2 = async (setToken: (t: string) => void) => {
    await Promise.resolve()
    validTokens = new Set(['T2'])
    act(() => setToken('T2'))
  }

  // -------------------------------------------------------------------------
  describe('token rotation', () => {
    it('reconnects with the rotated token after the gateway closes at JWT expiry', async () => {
      const app = boot(refreshToT2)
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('swaps cleanly when a REST 401 rotates the token while the socket is healthy', async () => {
      const app = boot(noRefresh)
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })

      await act(async () => {
        validTokens = new Set(['T1', 'T2'])
        app.controls.setToken('T2')
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('recovers when the rotation lands on an already dead socket', async () => {
      const app = boot(noRefresh)
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick(50)
      })
      await act(async () => {
        validTokens = new Set(['T2'])
        app.controls.setToken('T2')
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('recovers when the rotation lands while a retry connect is in flight', async () => {
      const app = boot(async () => {
        await new Promise((r) => setTimeout(r, 400))
      })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick(250)
      })
      await act(async () => {
        validTokens = new Set(['T2'])
        app.controls.setToken('T2')
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('settles on the newest token when two rotations land back to back', async () => {
      const app = boot(noRefresh)
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick()
      })
      await act(async () => {
        app.controls.setToken('T2')
        await tick()
      })
      await act(async () => {
        validTokens = new Set(['T3'])
        app.controls.setToken('T3')
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T3').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('brings a chat surface back with the provider after a JWT-expiry close', async () => {
      const app = boot(refreshToT2, { withChat: true, chatOpenInitially: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('brings a chat surface across a rotation on a healthy socket', async () => {
      const app = boot(noRefresh, { withChat: true, chatOpenInitially: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      await act(async () => {
        validTokens = new Set(['T1', 'T2'])
        app.controls.setToken('T2')
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)
  })

  // -------------------------------------------------------------------------
  describe('reuse of a cached connection', () => {
    // `connectPromise` used to survive a SUCCESSFUL connect, so re-acquiring a
    // still-cached connection whose socket had since died joined that settled
    // promise instead of dialling: no connect, no failure, nothing to schedule
    // a retry, and no status event coming either. Permanently dead.
    it('dials again when the URL returns to a cached value inside the release grace', async () => {
      const app = boot(noRefresh)
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })

      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        app.controls.setToken('') // getWsUrl() -> null, connection released
        await tick()
      })
      await act(async () => {
        app.controls.setToken('T1') // same URL, still inside SHARED_CLOSE_DELAY_MS
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T1').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('dials again when the URL returns after the release grace has expired', async () => {
      const app = boot(noRefresh)
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })

      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        app.controls.setToken('')
        await tick()
      })
      await tick(NATS_DEFAULTS.SHARED_CLOSE_DELAY_MS + 500) // cache entry is gone
      await act(async () => {
        app.controls.setToken('T1')
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T1').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('reconnects when a chat surface re-opens on the same URL with the socket dead', async () => {
      const app = boot(noRefresh, { withChat: true, chatOpenInitially: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      await act(async () => {
        app.controls.setChatOpen(false)
        await tick()
      })
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick()
      })
      await act(async () => {
        app.controls.setChatOpen(true)
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T1').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)
  })

  // -------------------------------------------------------------------------
  describe('retry ownership across consumers', () => {
    // `retryTimer` lives on the CONNECTION, and every lifecycle used to clear
    // it on stop() whether or not it owned the loop. So any consumer merely
    // re-running its effect during a backoff — a dialog closing, an `enabled`
    // toggle, a route change — cancelled reconnect for everyone still attached,
    // and nothing rearmed it: retry is only ever scheduled from a status event,
    // and a socket that is already down produces none.
    it('keeps retrying when a chat surface unmounts mid-backoff (chat owned the loop)', async () => {
      const app = boot(noRefresh, { withChat: true, chatOpenInitially: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick(1200)
      })
      const attempts = sockets.length
      expect(attempts).toBeGreaterThan(1)

      await act(async () => {
        app.controls.setChatOpen(false)
        await tick(50)
      })

      validTokens = new Set(['T1'])
      await waitFor(() => expect(openSocketsFor('T1').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('keeps retrying when a NON-owner chat surface unmounts mid-backoff', async () => {
      // Provider connects alone first, so it owns the loop; the chat surface
      // attaching later is a pure observer whose stop() must not touch it.
      const app = boot(noRefresh, { withChat: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      validTokens = new Set(['T1'])
      await act(async () => {
        app.controls.setChatOpen(true)
        await tick(50)
      })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick(1500)
      })
      const attempts = sockets.length
      expect(attempts).toBeGreaterThan(1)
      // Without this the unmount can land while a dial is in flight instead of
      // while the timer is armed, and the dial's own catch reschedules — so the
      // test would pass against the unfixed code. Polled rather than sampled:
      // the attempt this lands on is jittered, so a single read can catch the
      // dial rather than the backoff and fail the code for the harness's sake.
      await waitFor(
        () => expect(getSharedConnectionFor(currentUrl('T1'))?.retryTimer ?? null).not.toBeNull(),
        { timeout: READY_TIMEOUT },
      )

      await act(async () => {
        app.controls.setChatOpen(false)
        await tick(50)
      })

      validTokens = new Set(['T1'])
      await waitFor(() => expect(openSocketsFor('T1').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      expect(sockets.length).toBeGreaterThan(attempts)
    }, TEST_TIMEOUT)

    it('lets a re-opened chat surface join the connection the survivor restored', async () => {
      const app = boot(noRefresh, { withChat: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      validTokens = new Set(['T1'])
      await act(async () => {
        app.controls.setChatOpen(true)
        await tick(50)
      })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick(1500)
      })
      await act(async () => {
        app.controls.setChatOpen(false)
        await tick(50)
      })
      validTokens = new Set(['T1'])

      await waitFor(() => expect(openSocketsFor('T1').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })

      await act(async () => {
        app.controls.setChatOpen(true)
        await tick(100)
      })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    it('recovers when a chat surface unmounts and the token then rotates', async () => {
      const app = boot(async () => {
        await new Promise((r) => setTimeout(r, 3000))
      }, { withChat: true, chatOpenInitially: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      validTokens = new Set()
      await act(async () => {
        openSocketsFor('T1')[0].serverClose()
        await tick(20)
      })
      await act(async () => {
        app.controls.setChatOpen(false)
        await tick(20)
      })
      await act(async () => {
        validTokens = new Set(['T2'])
        app.controls.setToken('T2')
        await tick()
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)

    // Two consumers that have both re-pointed at a new URL but have not torn
    // down yet used to alternate ownership forever — each pass released the
    // loop, handed it to the other, and ran onBeforeReconnect (a token refresh
    // in the real callers) without dialling anything. Measured at 39 refreshes
    // in 3s before the fix.
    it('does not pass the loop between lifecycles that have all moved to another URL', async () => {
      const url = currentUrl('T1')
      const movedOn = currentUrl('T2')
      let refreshes = 0
      const onBeforeReconnect = async () => {
        refreshes += 1
      }

      const conn = acquireClient(url, CLIENT)
      acquireClient(url, CLIENT)
      // Dial directly: nothing connects on acquire, and attaching a lifecycle
      // that still wants this URL would make it a legitimate successor.
      await act(async () => {
        await conn.client.connect()
      })
      expect(conn.client.isConnected()).toBe(true)

      const a = startConnectionLifecycle({
        conn,
        wsUrl: url,
        onBeforeReconnect,
        backoff: BACKOFF,
        getFreshUrl: () => movedOn,
      })
      const b = startConnectionLifecycle({
        conn,
        wsUrl: url,
        onBeforeReconnect,
        backoff: BACKOFF,
        getFreshUrl: () => movedOn,
      })

      validTokens = new Set()
      openSocketsFor('T1')[0].serverClose()
      await tick(1_500)

      expect(refreshes).toBe(0)
      expect(conn.retryTimer).toBeNull()

      a.stop()
      b.stop()
      releaseClient(url)
      releaseClient(url)
    }, TEST_TIMEOUT)

    it('recovers from a drop after a rotation moved every lifecycle', async () => {
      const app = boot(noRefresh, { withChat: true })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: READY_TIMEOUT })
      validTokens = new Set(['T1', 'T2'])
      await act(async () => {
        app.controls.setChatOpen(true)
        await tick(50)
      })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: READY_TIMEOUT })

      await act(async () => {
        app.controls.setToken('T2')
        await tick(100)
      })
      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.chat.connected).toBe(true), { timeout: RECOVERY_TIMEOUT })

      await act(async () => {
        app.controls.setChatOpen(false)
        await tick(50)
      })
      await act(async () => {
        openSocketsFor('T2')[0].serverClose()
        await tick(100)
      })

      await waitFor(() => expect(openSocketsFor('T2').length).toBeGreaterThan(0), { timeout: RECOVERY_TIMEOUT })
      await waitFor(() => expect(app.provider.ready).toBe(true), { timeout: RECOVERY_TIMEOUT })
    }, TEST_TIMEOUT)
  })

  // -------------------------------------------------------------------------
  describe('status mapping', () => {
    // `staleConnection` and `client initiated reconnect` both contain "connect"
    // and neither contains "disconnect", so substring matching reported them as
    // CONNECTED — a live connection announced at the moment the client gave up
    // on one, plus a phantom `reconnectionCount` bump that every subscriber
    // reads as "the tail came back".
    it('reports staleConnection as disconnected, with no phantom reconnect', async () => {
      const statuses: NatsStatus[] = []
      let reconnectionCount = 0

      function Spy() {
        const nats = useNats()
        React.useEffect(() => {
          statuses.push(nats.status)
          reconnectionCount = nats.reconnectionCount
        })
        return null
      }

      function StaleApp() {
        const getWsUrl = React.useCallback(() => currentUrl('T1'), [])
        return (
          <NatsProvider
            getWsUrl={getWsUrl}
            onBeforeReconnect={noRefresh}
            clientConfig={{ ...CLIENT, pingIntervalMs: 80, maxPingOut: 1 }}
            reconnectionBackoff={{ fastRetries: 0, initialDelayMs: 30000 }}
            urlRevision="T1"
          >
            <Spy />
          </NatsProvider>
        )
      }

      render(<StaleApp />)
      await waitFor(() => expect(statuses).toContain('connected'), { timeout: READY_TIMEOUT })

      const mark = statuses.length
      suppressPong = true
      await tick(600)

      const afterPongLoss = statuses.slice(mark)
      expect(afterPongLoss).toContain('disconnected')
      expect(afterPongLoss).not.toContain('connected')
      expect(reconnectionCount).toBe(0)
    }, TEST_TIMEOUT)
  })
})
