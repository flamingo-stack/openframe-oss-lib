import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { ApprovalRequestMessage } from '@flamingo-stack/openframe-frontend-core/components/chat'
import { Button, Input, Textarea } from '@flamingo-stack/openframe-frontend-core/components/ui'
import { EP } from '../config/endpoints'

/**
 * MCP Playground — drives the hub's MCP server (`/api/mcp`) through the
 * SAME reverse proxy every other surface here uses: the page talks to
 * `/content/api/mcp` same-origin, the proxy injects the chat secret +
 * act-as identity (proxy/inject.mjs), and the OFFICIAL MCP client SDK
 * does the protocol work. Nothing on this page holds a credential.
 *
 * What it proves, end to end:
 *   - tools/list (the deployment source's capabilities)
 *   - ask_guide with conversation continuity (server-minted handle)
 *   - search_docs raw retrieval
 *   - ANY write tool generically (create_ticket, create_clickup_task, …)
 *     → pending_approval card → confirm_proposal approve/reject
 *
 * The approval card IS the chat's own `ApprovalRequestMessage` — the MCP
 * `pending_approval` payload is the chat's card payload by construction
 * (`buildApprovalCardPayload`), and rendering it through the same
 * component is the parity this page exists to demonstrate.
 *
 * The tool list is the DEPLOYMENT's — each platform's hub serves its own
 * source (point `.env` `HUB_ORIGIN` at a product-hub deployment to see the
 * ClickUp tools), exactly what a LangChain4j consumer would see.
 */

interface ToolInfo {
  name: string
  title?: string
  description?: string
  inputSchema?: unknown
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

interface PendingApproval {
  proposalId: string
  toolName: string | null
  title?: string
  fields?: Array<{ label: string; value: string }>
  explanation?: string | null
  conversationId?: string | null
}

type CallResult = { text: string; structured: Record<string, unknown> | null; isError: boolean }

function resultOf(raw: unknown): CallResult {
  const r = raw as {
    content?: Array<{ type?: string; text?: string }>
    structuredContent?: Record<string, unknown>
    isError?: boolean
  }
  return {
    text: (r.content ?? [])
      .map(c => (c.type === 'text' ? (c.text ?? '') : ''))
      .join('\n')
      .trim(),
    structured: r.structuredContent ?? null,
    isError: r.isError === true,
  }
}

const panel =
  'rounded-lg border border-ods-border bg-ods-card p-[var(--spacing-system-mf)] space-y-[var(--spacing-system-sf)]'
const label = 'text-h5 text-ods-text-secondary'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function McpPlaygroundPage() {
  const clientRef = useRef<Client | null>(null)
  const mountedRef = useRef(true)
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [statusDetail, setStatusDetail] = useState('')
  const [tools, setTools] = useState<ToolInfo[]>([])

  // ask_guide
  const [question, setQuestion] = useState('What is OpenFrame, in one sentence?')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)
  const [citationCount, setCitationCount] = useState(0)

  // search_docs
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([])

  // generic tool call
  const [selectedTool, setSelectedTool] = useState('')
  const [argsJson, setArgsJson] = useState('{}')
  const [calling, setCalling] = useState(false)
  const [callOutput, setCallOutput] = useState<CallResult | null>(null)

  // approvals (from ask_guide AND generic calls)
  const [pending, setPending] = useState<PendingApproval[]>([])
  const [decisions, setDecisions] = useState<
    Record<string, { status: 'approved' | 'rejected' | 'cancelled'; text: string }>
  >({})

  // Attempt token: a stale connect (superseded by a newer click) must close
  // ITS OWN client and write no state — otherwise two rapid Reconnects leak
  // the loser's transport and can leave `clientRef` on the older session.
  const attemptRef = useRef(0)
  const connect = useCallback(async () => {
    const attempt = ++attemptRef.current
    setStatus('connecting')
    setStatusDetail('')
    setTools([])
    // Detach the old client BEFORE the async connect: a failed reconnect
    // must not leave callTool talking to an already-closed transport.
    clientRef.current?.close().catch(() => {})
    clientRef.current = null
    // Hoisted out of the try so the catch can close a client whose
    // connect SUCCEEDED but whose listTools then threw — otherwise that
    // session leaks (it was never installed in clientRef).
    let client: Client | null = null
    try {
      const url = new URL(EP.mcp, window.location.origin)
      client = new Client({ name: 'react-embedding-example', version: '1.0.0' })
      await client.connect(new StreamableHTTPClientTransport(url))
      if (!mountedRef.current || attempt !== attemptRef.current) {
        // Unmounted or superseded mid-connect — don't install a transport
        // nobody closes.
        client.close().catch(() => {})
        return
      }
      const listed = await client.listTools()
      clientRef.current = client
      setTools(listed.tools as ToolInfo[])
      setSelectedTool(prev => prev || (listed.tools[0]?.name ?? ''))
      setStatus('ready')
    } catch (err) {
      client?.close().catch(() => {})
      if (!mountedRef.current || attempt !== attemptRef.current) return
      setStatus('error')
      setStatusDetail(errText(err))
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void connect()
    return () => {
      mountedRef.current = false
      clientRef.current?.close().catch(() => {})
      clientRef.current = null
    }
  }, [connect])

  const callTool = useCallback(async (name: string, args: Record<string, unknown>) => {
    const client = clientRef.current
    if (!client) throw new Error('Not connected')
    return resultOf(await client.callTool({ name, arguments: args }))
  }, [])

  const ask = useCallback(async () => {
    setAsking(true)
    setAnswer(null)
    try {
      const result = await callTool('ask_guide', {
        question,
        ...(conversationId ? { conversationId } : {}),
      })
      setAnswer(result.text)
      const s = result.structured as {
        conversationId?: string
        citations?: unknown[]
        pendingApprovals?: PendingApproval[]
      } | null
      if (s?.conversationId) setConversationId(s.conversationId)
      setCitationCount(s?.citations?.length ?? 0)
      if (s?.pendingApprovals?.length) {
        setPending(prev => [
          ...prev,
          ...s.pendingApprovals!.map(p => ({ ...p, conversationId: s.conversationId ?? null })),
        ])
      }
    } catch (err) {
      setAnswer(`Error: ${errText(err)}`)
    } finally {
      setAsking(false)
    }
  }, [callTool, question, conversationId])

  const search = useCallback(async () => {
    setSearching(true)
    try {
      const result = await callTool('search_docs', { query, limit: 8 })
      const s = result.structured as { results?: Array<Record<string, unknown>> } | null
      setSearchResults(s?.results ?? [])
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [callTool, query])

  const runGeneric = useCallback(async () => {
    setCalling(true)
    setCallOutput(null)
    try {
      let args: Record<string, unknown>
      try {
        args = JSON.parse(argsJson || '{}') as Record<string, unknown>
      } catch {
        throw new Error('Args must be valid JSON')
      }
      const result = await callTool(selectedTool, args)
      setCallOutput(result)
      const s = result.structured as
        | ({ status?: string } & PendingApproval & { conversationId?: string })
        | null
      if (s?.status === 'pending_approval' && s.proposalId) {
        setPending(prev => [...prev, { ...s, toolName: s.toolName ?? selectedTool }])
      }
    } catch (err) {
      setCallOutput({ text: errText(err), structured: null, isError: true })
    } finally {
      setCalling(false)
    }
  }, [argsJson, callTool, selectedTool])

  // Per-card serialization is the approval component's own `isProcessing`
  // (buttons disable while the handler's promise is pending); distinct
  // proposals may decide concurrently — they race on distinct CAS rows.
  const decide = useCallback(
    async (p: PendingApproval, action: 'approve' | 'reject') => {
      try {
        const result = await callTool('confirm_proposal', {
          proposalId: p.proposalId,
          action,
          ...(p.conversationId ? { conversationId: p.conversationId } : {}),
        })
        const s = result.structured as {
          status?: string
          receipt?: string
          message?: string
        } | null
        setDecisions(prev => ({
          ...prev,
          [p.proposalId]: {
            // Only the two REAL outcomes wear their tags; everything else
            // (expired/conflict/invalid_args/error) is 'cancelled' — a
            // conflict in particular means a RACING approve executed, and
            // a red "Rejected" tag would assert the opposite.
            status:
              s?.status === 'executed'
                ? 'approved'
                : s?.status === 'rejected'
                  ? 'rejected'
                  : 'cancelled',
            // Prefer the server's honest copy ("This approval expired —
            // …") over the bare status token it rides beside.
            text: s?.receipt ?? s?.message ?? s?.status ?? (result.isError ? result.text : action),
          },
        }))
      } catch (err) {
        setDecisions(prev => ({
          ...prev,
          [p.proposalId]: { status: 'cancelled', text: `Error: ${errText(err)}` },
        }))
      }
    },
    [callTool],
  )

  const selectedSchema = useMemo(
    () => tools.find(t => t.name === selectedTool)?.inputSchema,
    [tools, selectedTool],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-[var(--spacing-system-lf)] px-[var(--spacing-system-mf)] py-[var(--spacing-system-xl)] text-ods-text-primary">
      <header className="space-y-[var(--spacing-system-xsf)]">
        <h1 className="text-h2">MCP Playground</h1>
        <p className="text-h6 text-ods-text-secondary">
          Drives the hub&apos;s MCP server through the /content proxy (secret + act-as injected
          server-side). Same endpoint, same tools a LangChain4j agent or Claude would see.
        </p>
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xsf)]">
          <span
            className={`rounded-full px-[var(--spacing-system-sf)] py-[var(--spacing-system-xxs)] text-badge font-medium ${
              status === 'ready'
                ? 'bg-ods-success-secondary text-ods-success'
                : status === 'error'
                  ? 'bg-ods-error-secondary text-ods-error'
                  : 'bg-ods-card text-ods-text-secondary'
            }`}
          >
            {status === 'ready'
              ? `Connected — ${tools.length} tool${tools.length === 1 ? '' : 's'}`
              : status === 'error'
                ? `Connection failed${statusDetail ? `: ${statusDetail}` : ''}`
                : 'Connecting…'}
          </span>
          <Button variant="outline" size="small" disabled={status === 'connecting'} onClick={() => void connect()}>
            Reconnect
          </Button>
        </div>
      </header>

      {tools.length > 0 && (
        <section className={panel}>
          <p className={label}>tools/list (this deployment&apos;s capabilities)</p>
          <ul className="grid gap-[var(--spacing-system-xsf)] sm:grid-cols-2">
            {tools.map(t => (
              <li key={t.name} className="rounded-md border border-ods-border p-[var(--spacing-system-sf)]">
                <p className="text-code">{t.name}</p>
                <p className="mt-[var(--spacing-system-xxs)] line-clamp-3 text-badge text-ods-text-secondary">{t.description}</p>
                <p className="mt-[var(--spacing-system-xxs)] text-badge text-ods-text-secondary">
                  {t.annotations?.readOnlyHint
                    ? 'read-only'
                    : t.annotations?.destructiveHint
                      ? 'write · destructive · approval-gated'
                      : 'write · approval-gated'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={panel}>
        <p className={label}>ask_guide {conversationId ? `· conversation ${conversationId.slice(0, 8)}…` : ''}</p>
        <div className="flex gap-[var(--spacing-system-xsf)]">
          <Input value={question} onChange={e => setQuestion(e.target.value)} />
          <Button size="small" disabled={asking || status !== 'ready'} onClick={() => void ask()}>
            {asking ? 'Asking…' : 'Ask'}
          </Button>
          {conversationId && (
            <Button variant="outline" size="small" onClick={() => setConversationId(null)}>
              New conversation
            </Button>
          )}
        </div>
        {answer !== null && (
          <div className="space-y-[var(--spacing-system-xxs)]">
            <div className="whitespace-pre-wrap rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)] text-h6">{answer}</div>
            <p className="text-badge text-ods-text-secondary">{citationCount} citation source(s)</p>
          </div>
        )}
      </section>

      <section className={panel}>
        <p className={label}>search_docs</p>
        <div className="flex gap-[var(--spacing-system-xsf)]">
          <Input
            placeholder="Full-text search the knowledge base"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Button
            size="small"
            disabled={searching || !query.trim() || status !== 'ready'}
            onClick={() => void search()}
          >
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </div>
        {searchResults.length > 0 && (
          <ul className="space-y-[var(--spacing-system-xsf)]">
            {searchResults.map((r, i) => (
              <li key={i} className="rounded-md border border-ods-border p-[var(--spacing-system-sf)]">
                <p className="text-h6">{String(r.title ?? '')}</p>
                <p className="line-clamp-2 text-badge text-ods-text-secondary">{String(r.preview ?? '')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <p className={label}>call any tool (write tools return pending proposals)</p>
        <div className="flex flex-wrap gap-[var(--spacing-system-xsf)]">
          {/* Raw select on purpose: the kit's Select is the full Radix
              popover stack — heavier than this single-control demo needs. */}
          <select
            className="w-64 rounded-md border border-ods-border bg-ods-bg px-[var(--spacing-system-sf)] py-[var(--spacing-system-xxs)] text-h6 text-ods-text-primary focus:outline-none focus:border-ods-border-focus"
            value={selectedTool}
            onChange={e => setSelectedTool(e.target.value)}
          >
            {tools.map(t => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <Button size="small" disabled={calling || status !== 'ready'} onClick={() => void runGeneric()}>
            {calling ? 'Calling…' : 'Call tool'}
          </Button>
        </div>
        <Textarea
          className="min-h-24 text-code"
          value={argsJson}
          onChange={e => setArgsJson(e.target.value)}
          spellCheck={false}
        />
        {selectedSchema != null && (
          <details className="text-badge text-ods-text-secondary">
            <summary className="cursor-pointer">input schema</summary>
            <pre className="mt-[var(--spacing-system-xxs)] overflow-x-auto rounded-md bg-ods-bg p-[var(--spacing-system-xsf)]">{JSON.stringify(selectedSchema, null, 2)}</pre>
          </details>
        )}
        {callOutput && (
          <pre
            className={`overflow-x-auto rounded-md border p-[var(--spacing-system-sf)] text-code ${
              callOutput.isError ? 'border-ods-error text-ods-error' : 'border-ods-border'
            }`}
          >
            {callOutput.structured ? JSON.stringify(callOutput.structured, null, 2) : callOutput.text}
          </pre>
        )}
      </section>

      {pending.length > 0 && (
        <section className={panel}>
          <p className={label}>pending approvals</p>
          <ul className="space-y-[var(--spacing-system-sf)]">
            {pending.map(p => {
              const decided = decisions[p.proposalId]
              return (
                <li key={p.proposalId}>
                  {/* The chat's OWN approval card — the MCP pending payload is
                      the chat's card payload by construction, so the same
                      component renders it (in-flight double-click protection
                      included). */}
                  <ApprovalRequestMessage
                    data={{
                      requestId: p.proposalId,
                      command: p.title ?? p.toolName ?? 'Proposed action',
                      fields: p.fields,
                      explanation: p.explanation ?? undefined,
                    }}
                    status={decided?.status ?? 'pending'}
                    onApprove={() => decide(p, 'approve')}
                    onReject={() => decide(p, 'reject')}
                  />
                  {decided && (
                    <p className="mt-[var(--spacing-system-xxs)] text-badge text-ods-text-secondary">{decided.text}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
