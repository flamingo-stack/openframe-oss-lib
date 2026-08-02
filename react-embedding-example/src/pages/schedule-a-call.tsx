import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler'
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui'
import { PageError } from '../components/page-state'
import { EP } from '../config/endpoints'
import { CONTENT_PREFIX } from '../config/content'

/**
 * Meeting scheduler embed proof — the natively-branded HubSpot booking flow
 * (`docs/EMBEDDING_HUBSPOT_MEETINGS.md`) running through the same `/content`
 * proxy as every other surface. The widget itself calls
 * `${apiBaseUrl}/api/meetings/availability` + `/api/meetings/book`, so
 * `apiBaseUrl={CONTENT_PREFIX}` routes both through the proxy with zero
 * extra wiring (client mode: no SSR seed — skeleton + self-fetch).
 *
 * Two shapes, mirroring the hub page:
 *  - `/schedule-a-call` — the DIRECTORY (grouped by purpose, this page's
 *    picker) + the widget for the selected link.
 *  - `/schedule-a-call/<hubspot-slug>` — a PATH deep-link resolved through
 *    `GET /api/meetings?slug=…` (any real portal link books natively, even
 *    outside the naming convention — white-label rule).
 */

interface ResolvedLink {
  meetingId: string
  inDirectory: boolean
  title: string
  description: string | null
  fallbackUrl: string
}

interface DirectoryLink {
  id: string
  link: string
  purpose: string
  title: string
  description: string | null
  subtitle: string | null
  kind: 'personal' | 'team'
  durationsMinutes: number[]
}

interface DirectoryPayload {
  purposes: Array<{ purpose: string; label: string; links: DirectoryLink[] }>
}

export function ScheduleACallPage() {
  const params = useParams()
  const slugPath = params['*'] || null

  const [directory, setDirectory] = useState<DirectoryPayload | null>(null)
  const [resolved, setResolved] = useState<ResolvedLink | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DirectoryLink | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    if (slugPath) {
      fetch(`${EP.meetings}?slug=${encodeURIComponent(slugPath)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`slug resolve ${r.status}`))))
        .then((link: ResolvedLink) => setResolved(link))
        .catch((e) => {
          if (!(e instanceof DOMException && e.name === 'AbortError')) setError(String(e))
        })
    } else {
      fetch(EP.meetings, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`meetings ${r.status}`))))
        .then((payload: DirectoryPayload) => {
          setDirectory(payload)
          setSelected(payload.purposes[0]?.links[0] ?? null)
        })
        .catch((e) => {
          if (!(e instanceof DOMException && e.name === 'AbortError')) setError(String(e))
        })
    }
    return () => controller.abort()
  }, [slugPath])

  if (error) return <PageError title="Couldn't load scheduling links" detail={error} />

  // Path deep-link: one resolved link, rendered standalone (hub parity).
  if (slugPath) {
    return (
      <div className="p-6 flex flex-col gap-[var(--spacing-system-lf)]">
        <h1 className="text-h2 text-ods-text-primary">{resolved?.title ?? 'Schedule a call'}</h1>
        {resolved?.description && <p className="text-h6 text-ods-text-secondary">{resolved.description}</p>}
        {resolved && (
          <HubSpotMeetingScheduler
            meetingId={resolved.meetingId}
            apiBaseUrl={CONTENT_PREFIX}
            fallbackUrl={resolved.fallbackUrl}
          />
        )}
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-[var(--spacing-system-lf)]">
      <h1 className="text-h2 text-ods-text-primary">Schedule a call</h1>
      {directory?.purposes.length === 0 && (
        <p className="text-h6 text-ods-text-secondary">
          No scheduling links match the naming convention yet — rename one in HubSpot to
          <code> call-&lt;purpose&gt;-&lt;descriptor&gt;</code> and it appears here.
        </p>
      )}
      {directory?.purposes.map((p) => (
        <div key={p.purpose} className="flex flex-col gap-[var(--spacing-system-xs)]">
          <p className="text-h5 text-ods-text-primary">{p.label}</p>
          <div className="flex flex-wrap gap-[var(--spacing-system-xs)]">
            {p.links.map((l) => (
              <Button
                key={l.id}
                variant={selected?.id === l.id ? undefined : 'outline'}
                size="small-legacy"
                onClick={() => setSelected(l)}
              >
                {l.title}
              </Button>
            ))}
          </div>
        </div>
      ))}
      {selected && (
        <HubSpotMeetingScheduler
          key={selected.id}
          meetingId={selected.id}
          apiBaseUrl={CONTENT_PREFIX}
          fallbackUrl={selected.link}
        />
      )}
    </div>
  )
}
