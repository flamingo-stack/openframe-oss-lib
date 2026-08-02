import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  HubSpotMeetingScheduler,
  MeetingSchedulerDirectory,
} from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler'
import { PageError } from '../components/page-state'
import { EP } from '../config/endpoints'
import { CONTENT_PREFIX } from '../config/content'

/**
 * Meeting scheduler embed proof — BOTH embed shapes from
 * `docs/EMBEDDING_HUBSPOT_MEETINGS.md`, running through the same `/content`
 * proxy as every other surface:
 *
 *  1. `/schedule-a-call` — the DIRECTORY block: `MeetingSchedulerDirectory`
 *     (row cards + skeletons + pagination, all lib-internal). Rows navigate
 *     to `/schedule-a-call/<hubspot-slug>`. Append `?scope=all` to list every
 *     portal link (server-side filtered).
 *  2. `/schedule-a-call/<hubspot-slug>` — the SINGLE-LINK booking page:
 *     slug resolved via `GET /api/meetings?slug=…`, then the full
 *     `HubSpotMeetingScheduler` widget (calendar → slots → form →
 *     confirmation) in client mode (skeleton + self-fetch, no SSR seed).
 */

interface ResolvedLink {
  meetingId: string
  inDirectory: boolean
  title: string
  description: string | null
  fallbackUrl: string
}

export function ScheduleACallPage() {
  const params = useParams()
  const location = useLocation()
  const slugPath = params['*'] || null
  const includeAll = new URLSearchParams(location.search).get('scope') === 'all'

  const [resolved, setResolved] = useState<ResolvedLink | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Route change: clear BOTH branches' state up front — a stale `resolved`
    // could render (and book!) the previous meeting, and a stale `error`
    // would block the new route entirely.
    setResolved(null)
    setError(null)
    if (!slugPath) return
    const controller = new AbortController()
    fetch(`${EP.meetings}?slug=${encodeURIComponent(slugPath)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`slug resolve ${r.status}`))))
      .then((link: ResolvedLink) => setResolved(link))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError(String(e))
      })
    return () => controller.abort()
  }, [slugPath])

  if (error) return <PageError title="Couldn't load scheduling links" detail={error} />

  // Single-link embed: resolved slug → the full booking widget.
  if (slugPath) {
    return (
      <div className="space-y-8 p-6">
        <h1 className="text-2xl font-semibold text-ods-text-primary">{resolved?.title ?? 'Schedule a call'}</h1>
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

  // Directory embed: the whole block (rows + skeletons + pagination) is ONE
  // lib component — the host page only positions it.
  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold text-ods-text-primary">Schedule a call</h1>
      <MeetingSchedulerDirectory
        apiBaseUrl={CONTENT_PREFIX}
        includeAll={includeAll}
        bookingBasePath="/schedule-a-call"
        contactHref="/contact"
      />
    </div>
  )
}
