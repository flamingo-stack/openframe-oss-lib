import { useEffect, useState } from 'react'
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
 * This page only supplies the DIRECTORY (which links exist, grouped by
 * purpose) — everything below the picker is the lib widget.
 */

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
  const [directory, setDirectory] = useState<DirectoryPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<DirectoryLink | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(EP.meetings, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`meetings ${r.status}`))))
      .then((payload: DirectoryPayload) => {
        setDirectory(payload)
        setSelected(payload.purposes[0]?.links[0] ?? null)
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError(String(e))
      })
    return () => controller.abort()
  }, [])

  if (error) return <PageError title="Couldn't load scheduling links" detail={error} />

  return (
    <div className="p-6 flex flex-col gap-[var(--spacing-system-lf)]">
      <h1 className="text-h2 text-ods-text-primary">Schedule a call</h1>
      {directory?.purposes.length === 0 && (
        <p className="text-h6 text-ods-text-secondary">
          No scheduling links match the naming convention yet — rename one in HubSpot to
          <code> call-&lt;purpose&gt;--&lt;descriptor&gt;</code> and it appears here.
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
