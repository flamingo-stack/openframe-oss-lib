import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
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

const panel = 'rounded-lg border border-ods-border bg-ods-card p-4 space-y-3'
const label = 'text-xs font-medium uppercase tracking-wide text-ods-text-secondary'
const input =
  'w-full rounded-md border border-ods-border bg-ods-bg px-3 py-2 text-sm text-ods-text-primary focus:outline-none focus:border-ods-accent-primary'
const button =
  'rounded-md border border-ods-border bg-ods-bg px-3 py-1.5 text-sm text-ods-text-primary hover:border-ods-accent-primary disabled:opacity-40'
const primaryButton =
  'rounded-md bg-ods-accent-primary px-3 py-1.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-40'

export function McpPlaygroundPage() {
  const clientRef = useRef<Client | null>(null)
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
  const [decisions, setDecisions] = useState<Record<string, string>>({})

  const connect = useCallback(async () => {
    setStatus('connecting')
    setStatusDetail('')
    setTools([])
    clientRef.current?.close().catch(() => {})
    try {
      const url = new URL(EP.mcp, window.location.origin)
      const client = new Client({ name: 'react-embedding-example', version: '1.0.0' })
      await client.connect(new StreamableHTTPClientTransport(url))
      const listed = await client.listTools()
      clientRef.current = client
      setTools(listed.tools as ToolInfo[])
      setSelectedTool(prev => prev || (listed.tools[0]?.name ?? ''))
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setStatusDetail(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void connect()
    return () => {
      clientRef.current?.close().catch(() => {})
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
      setAnswer(`Error: ${err instanceof Error ? err.message : String(err)}`)
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
      setCallOutput({ text: err instanceof Error ? err.message : String(err), structured: null, isError: true })
    } finally {
      setCalling(false)
    }
  }, [argsJson, callTool, selectedTool])

  const decide = useCallback(
    async (p: PendingApproval, action: 'approve' | 'reject') => {
      try {
        const result = await callTool('confirm_proposal', {
          proposalId: p.proposalId,
          action,
          ...(p.conversationId ? { conversationId: p.conversationId } : {}),
        })
        const s = result.structured as { status?: string; receipt?: string } | null
        setDecisions(prev => ({
          ...prev,
          [p.proposalId]: s?.receipt ?? s?.status ?? (result.isError ? result.text : action),
        }))
      } catch (err) {
        setDecisions(prev => ({
          ...prev,
          [p.proposalId]: `Error: ${err instanceof Error ? err.message : String(err)}`,
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
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 text-ods-text-primary">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">MCP Playground</h1>
        <p className="text-sm text-ods-text-secondary">
          Drives the hub&apos;s MCP server through the /content proxy (secret + act-as injected
          server-side). Same endpoint, same tools a LangChain4j agent or Claude would see.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === 'ready'
                ? 'bg-ods-success/20 text-ods-success'
                : status === 'error'
                  ? 'bg-ods-error/20 text-ods-error'
                  : 'bg-ods-card text-ods-text-secondary'
            }`}
          >
            {status === 'ready'
              ? `Connected — ${tools.length} tool${tools.length === 1 ? '' : 's'}`
              : status === 'error'
                ? `Connection failed${statusDetail ? `: ${statusDetail}` : ''}`
                : 'Connecting…'}
          </span>
          <button type="button" className={button} onClick={() => void connect()}>
            Reconnect
          </button>
        </div>
      </header>

      {tools.length > 0 && (
        <section className={panel}>
          <p className={label}>tools/list (this deployment&apos;s capabilities)</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {tools.map(t => (
              <li key={t.name} className="rounded-md border border-ods-border p-3">
                <p className="font-mono text-sm">{t.name}</p>
                <p className="mt-1 line-clamp-3 text-xs text-ods-text-secondary">{t.description}</p>
                <p className="mt-1 text-xs text-ods-text-secondary">
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
        <div className="flex gap-2">
          <input className={input} value={question} onChange={e => setQuestion(e.target.value)} />
          <button type="button" className={primaryButton} disabled={asking || status !== 'ready'} onClick={() => void ask()}>
            {asking ? 'Asking…' : 'Ask'}
          </button>
          {conversationId && (
            <button type="button" className={button} onClick={() => setConversationId(null)}>
              New conversation
            </button>
          )}
        </div>
        {answer !== null && (
          <div className="space-y-1">
            <div className="whitespace-pre-wrap rounded-md border border-ods-border bg-ods-bg p-3 text-sm">{answer}</div>
            <p className="text-xs text-ods-text-secondary">{citationCount} citation source(s)</p>
          </div>
        )}
      </section>

      <section className={panel}>
        <p className={label}>search_docs</p>
        <div className="flex gap-2">
          <input
            className={input}
            placeholder="Full-text search the knowledge base"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button
            type="button"
            className={primaryButton}
            disabled={searching || !query.trim() || status !== 'ready'}
            onClick={() => void search()}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <ul className="space-y-2">
            {searchResults.map((r, i) => (
              <li key={i} className="rounded-md border border-ods-border p-3">
                <p className="text-sm font-medium">{String(r.title ?? '')}</p>
                <p className="line-clamp-2 text-xs text-ods-text-secondary">{String(r.preview ?? '')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <p className={label}>call any tool (write tools return pending proposals)</p>
        <div className="flex flex-wrap gap-2">
          <select className={`${input} !w-64`} value={selectedTool} onChange={e => setSelectedTool(e.target.value)}>
            {tools.map(t => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" className={primaryButton} disabled={calling || status !== 'ready'} onClick={() => void runGeneric()}>
            {calling ? 'Calling…' : 'Call tool'}
          </button>
        </div>
        <textarea
          className={`${input} min-h-24 font-mono text-xs`}
          value={argsJson}
          onChange={e => setArgsJson(e.target.value)}
          spellCheck={false}
        />
        {selectedSchema != null && (
          <details className="text-xs text-ods-text-secondary">
            <summary className="cursor-pointer">input schema</summary>
            <pre className="mt-1 overflow-x-auto rounded-md bg-ods-bg p-2">{JSON.stringify(selectedSchema, null, 2)}</pre>
          </details>
        )}
        {callOutput && (
          <pre
            className={`overflow-x-auto rounded-md border p-3 text-xs ${
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
          <ul className="space-y-3">
            {pending.map(p => (
              <li key={p.proposalId} className="rounded-md border border-ods-border p-3">
                <p className="text-sm font-medium">{p.title ?? p.toolName ?? 'Proposed action'}</p>
                {p.fields && p.fields.length > 0 && (
                  <dl className="mt-2 space-y-1 text-xs">
                    {p.fields.map(f => (
                      <div key={f.label} className="flex gap-2">
                        <dt className="w-32 shrink-0 text-ods-text-secondary">{f.label}</dt>
                        <dd className="break-words">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {decisions[p.proposalId] ? (
                  <p className="mt-2 text-xs text-ods-text-secondary">{decisions[p.proposalId]}</p>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={primaryButton} onClick={() => void decide(p, 'approve')}>
                      Approve
                    </button>
                    <button type="button" className={button} onClick={() => void decide(p, 'reject')}>
                      Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
