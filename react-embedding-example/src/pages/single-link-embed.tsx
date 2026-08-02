import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler'
import { PageError } from '../components/page-state'
import { EP } from '../config/endpoints'
import { CONTENT_PREFIX } from '../config/content'

/**
 * DIRECT single-link embed proof — the pattern for an embedder who has ONE
 * known meeting link and just wants the booking box on a page, no directory,
 * no routing:
 *
 *  - BOX: `<HubSpotMeetingScheduler>` dropped inline between ordinary page
 *    content — it's a plain component; the bordered card below sits in
 *    normal document flow.
 *  - PAGE: the same link as a full-page experience at
 *    `/schedule-a-call/<slug>` (linked below the box).
 *
 * The slug is the stable identity an embedder actually knows (it's the
 * public HubSpot URL path and IMMUTABLE after creation); the numeric
 * meetingId the widget needs is resolved ONCE via
 * `GET /api/meetings?slug=…`. An embedder that already knows the id can skip
 * the resolve and hardcode `meetingId` directly.
 */

// Hardcode YOUR link's slug here (the path of its meetings.hubspot.com URL).
const DIRECT_LINK_SLUG = 'michael-assraf/interview-with-michael'

interface ResolvedLink {
  meetingId: string
  title: string
  description: string | null
  fallbackUrl: string
}

export function SingleLinkEmbedPage() {
  const [resolved, setResolved] = useState<ResolvedLink | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${EP.meetings}?slug=${encodeURIComponent(DIRECT_LINK_SLUG)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`slug resolve ${r.status}`))))
      .then((link: ResolvedLink) => setResolved(link))
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === 'AbortError')) setError(String(e))
      })
    return () => controller.abort()
  }, [])

  if (error) return <PageError title="Couldn't resolve the demo link" detail={error} />

  return (
    <div className="space-y-8 p-6 max-w-5xl">
      <h1 className="text-2xl font-semibold text-ods-text-primary">Direct single-link embed</h1>
      <p className="text-h6 text-ods-text-secondary">
        One hardcoded link (<code className="text-code">{DIRECT_LINK_SLUG}</code>), no directory, no routing —
        the booking widget is a plain component you drop between your own content. Everything below the
        heading is ordinary page flow.
      </p>

      {/* ── THE BOX ─────────────────────────────────────────────────────── */}
      {resolved ? (
        <section className="flex flex-col gap-[var(--spacing-system-s)]">
          <h2 className="text-h3 text-ods-text-primary">{resolved.title}</h2>
          {resolved.description && <p className="text-h6 text-ods-text-secondary">{resolved.description}</p>}
          <HubSpotMeetingScheduler
            meetingId={resolved.meetingId}
            apiBaseUrl={CONTENT_PREFIX}
            fallbackUrl={resolved.fallbackUrl}
          />
        </section>
      ) : (
        // Client mode with no id yet — the widget's own skeleton takes over
        // the instant the resolve lands; this placeholder only bridges the
        // one-request resolve.
        <div className="min-h-[32rem]" aria-hidden />
      )}

      <p className="text-h6 text-ods-text-secondary">
        Prefer the full-page experience? The same link renders as its own page at{' '}
        <Link to={`/schedule-a-call/${DIRECT_LINK_SLUG}`} className="text-ods-accent underline">
          /schedule-a-call/{DIRECT_LINK_SLUG}
        </Link>
        .
      </p>
    </div>
  )
}
