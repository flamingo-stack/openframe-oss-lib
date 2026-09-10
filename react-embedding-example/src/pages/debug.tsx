import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardContent,
  Input,
  StatusBadge,
} from '@flamingo-stack/openframe-frontend-core/components/ui'
import {
  clearEmbedProxyAuth,
  getEmbedProxyAuth,
  setEmbedProxyAuth,
} from '@flamingo-stack/openframe-frontend-core/utils'

/**
 * `/debug` — the example's paste-creds page, mirroring the hub's own
 * `/debug` admin surface: paste a platform API key (minted in the hub's
 * `/admin/api-keys`) + an act-as email, and they persist to localStorage
 * (`chat.proxy-auth.v1`). Every embedded surface (chat, tickets, the MCP
 * playground) attaches them as `Authorization: Bearer` + `X-Chat-Act-As`
 * — the reverse proxy stays a credential-free path rewriter.
 */
export function DebugPage() {
  const [secret, setSecret] = useState('')
  const [email, setEmail] = useState('')
  const [activeEmail, setActiveEmail] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  useEffect(() => {
    const auth = getEmbedProxyAuth()
    if (auth) {
      setActiveEmail(auth.email)
      setEmail(auth.email)
    }
  }, [])

  const save = () => {
    const s = secret.trim()
    const e = email.trim().toLowerCase()
    if (!s || !e) {
      setStatus('Both fields are required.')
      return
    }
    setEmbedProxyAuth({ secret: s, email: e })
    setActiveEmail(e)
    setSecret('')
    setStatus(`Saved. Surfaces now act as ${e}.`)
  }

  const clear = () => {
    clearEmbedProxyAuth()
    setActiveEmail(null)
    setSecret('')
    setEmail('')
    setStatus('Cleared. Surfaces are anonymous again.')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-[var(--spacing-system-lf)] px-[var(--spacing-system-mf)] py-[var(--spacing-system-xl)] text-ods-text-primary">
      <header className="space-y-[var(--spacing-system-xsf)]">
        <h1 className="text-h2">Debug credentials</h1>
        <p className="text-h6 text-ods-text-secondary">
          Paste a platform API key (minted in the hub&apos;s /admin/api-keys) and an act-as email.
          They persist in this browser&apos;s localStorage; chat, tickets and the MCP playground
          attach them on every call.
        </p>
        {activeEmail && <StatusBadge singleLine colorScheme="success" text={`Active: ${activeEmail}`} />}
      </header>

      <Card>
        <CardContent className="space-y-[var(--spacing-system-sf)] p-[var(--spacing-system-mf)]">
          <Input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder={activeEmail ? 'API key (persisted, paste to replace)' : 'fpk_...'}
            autoComplete="off"
            spellCheck={false}
          />
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="act-as email, e.g. customer@example.com"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex items-center justify-between gap-[var(--spacing-system-sf)]">
            <span className="text-h6 text-ods-text-secondary">{status}</span>
            <div className="flex gap-[var(--spacing-system-xsf)]">
              <Button variant="outline" size="small" onClick={clear} disabled={!activeEmail && !secret && !email}>
                Clear
              </Button>
              <Button size="small" onClick={save} disabled={!secret.trim() || !email.trim()}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
