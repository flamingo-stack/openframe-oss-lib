# Embedding the Meeting Scheduler (`<HubSpotMeetingScheduler>`)

A natively-branded booking flow over the HubSpot Meetings scheduler — duration → slot →
details → confirmation — rendered entirely with the lib's ODS primitives. **No iframe, no
HubSpot chrome, no third-party scripts**: every color, font, and control is yours.

The widget talks ONLY to a **host proxy** (your backend), never to HubSpot directly — the
HubSpot private-app token stays server-side, and the availability/booking payloads reach
the browser pre-sanitized.

## What it is

```text
<HubSpotMeetingScheduler>                 your backend                    HubSpot
  GET  {apiBaseUrl}/api/meetings/availability  ──►  scheduler v3 book GET (UTC)
  POST {apiBaseUrl}/api/meetings/book          ──►  scheduler v3 book POST
```

Install (this subpath needs BOTH optional peers):

```bash
npm install zod @hookform/resolvers@~5.2.2 react-hook-form
```

> `@hookform/resolvers` is pinned `~5.2.2` across the Flamingo repos (the valibot
> ERESOLVE fix) — do not relax the pin.

## Minimum embed — Next.js (SSR mode)

The host page fetches the seed server-side; the widget renders the zone-independent shell
(durations, form metadata, consent copy) in the server HTML, resolves the visitor's
timezone after mount, and refetches availability unconditionally (the seed is first-paint
scaffolding for a 60-second-volatile resource, not truth).

```tsx
// app/schedule/page.tsx (Server Component)
import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler'

export default async function SchedulePage() {
  const availability = await fetch(
    'https://your-host/api/meetings/availability?meeting=10687363&monthOffset=0',
    { cache: 'no-store' },
  ).then((r) => (r.ok ? r.json() : null))

  return (
    <HubSpotMeetingScheduler
      meetingId="10687363"
      initialAvailability={availability ?? undefined}
      fallbackUrl="https://meetings.hubspot.com/some-one/intro-call"
    />
  )
}
```

## Minimum embed — standalone React (client mode)

> Working reference: [`react-embedding-example`](../../react-embedding-example)'s
> `/schedule-a-call` page mounts exactly this through its `/content` proxy
> (`src/pages/schedule-a-call.tsx` — directory picker + the widget with
> `apiBaseUrl={CONTENT_PREFIX}`).

Omit the seed — the widget renders a skeleton and self-fetches on mount. `apiBaseUrl`
points at **your own backend's** proxy prefix.

```tsx
import { HubSpotMeetingScheduler } from '@flamingo-stack/openframe-frontend-core/components/meeting-scheduler'

export function BookACall() {
  return (
    <HubSpotMeetingScheduler
      meetingId="10687363"
      apiBaseUrl="/booking-proxy"
      fallbackUrl="https://meetings.hubspot.com/some-one/intro-call"
    />
  )
}
```

**CORS stance:** the widget's requests are same-origin by design. The hub's booking route
is IP-rate-limited and bot-gated, so a browser-direct cross-origin call would misattribute
both — it deliberately serves **no CORS headers**. External embedders proxy
`/api/meetings/*` through their own backend (which may add its own auth/limits) and point
`apiBaseUrl` at that proxy.

## Host proxy endpoint contract (LOAD-BEARING)

This table is the artifact that keeps the widget's request paths and a host's routes
aligned — if you change one side, change the other in the same commit.

| Endpoint | Method | Query/body | Returns |
|---|---|---|---|
| `{apiBaseUrl}/api/meetings/availability` | GET | `meeting` (link id), `monthOffset` (0..`MAX_MONTH_OFFSET`) | `MeetingAvailability` — epoch-ms slots from HubSpot's `linkAvailability` ONLY (no busy times, no organizer data, no timezone — rendering is client-side) |
| `{apiBaseUrl}/api/meetings/book` | POST | `MeetingBookingPayload` (validate with `makeBookingSchema`, REBUILT server-side from the link's own metadata) + humanity signals | `BookingConfirmation` on 2xx; error envelope `{ error, code }` with `code ∈ MeetingBookingErrorCode` otherwise |

Error codes the widget reacts to: `SLOT_TAKEN` (refetch-and-recover), `VALIDATION`,
`LINK_GONE`, `TEMPORARILY_UNAVAILABLE` (retry affordance), `MEETING_UNAVAILABLE`
(daily booking ceiling — escape hatch, no retry timer).

**Bot protection is load-bearing**: the booking form mounts the lib's honeypot + timing
signals (`useHumanitySignals`) and merges them into the POST body. Your proxy should
verify them server-side (see `utils/humanity-signals` — `evaluateHumanitySignals`) and
strip `HUMANITY_SIGNAL_KEYS` before anything reaches HubSpot.

## The link naming convention (team process)

**The convention is NAME-ONLY.** HubSpot link slugs are IMMUTABLE after creation
(verified in-portal), so nothing semantic lives in the slug — it's an opaque URL
identity. The link **name** (freely editable in HubSpot at any time) carries
everything (executable parser: `utils/hubspot-meetings-convention`):

```text
Title | Short description | Audience Label
```

| Name | Listed? | Result |
|---|---|---|
| `Sales Demo \| 30-min walkthrough \| Prospect Buyers` | ✅ | title "Sales Demo", description on the row, grouped + chipped as "For Prospect Buyers" |
| `Support Triage \| Get unstuck \| OpenFrame Users` | ✅ | multi-word audiences just work — the label IS the grouping key (slugified) |
| `Interview with Michael` (no audience segment) | ❌ | UNLISTED — still natively bookable via its `/schedule-a-call/<slug>` deep link |

- The **Audience segment is the opt-in marker**: no third segment → not in the
  directory. That's what keeps default/personal links junk-free with zero config.
- Audiences are **fully dynamic** — the first link naming `| Partnerships` mints a
  "For Partnerships" group with zero code. Links sharing a label group together
  regardless of their slugs.
- An enabled **welcome screen** (per-link HubSpot toggle) wins over the name for
  title/description; the audience segment is name-only.
- Personal vs team marker comes from the link's `type` (`PERSONAL_LINK` vs
  `GROUP_CALENDAR`/`ROUND_ROBIN_CALENDAR` — live-probed vocabulary). Round-robin
  links keep the CREATOR's slug prefix in their URL (HubSpot's scheme) — irrelevant
  here, slugs carry no meaning.
- `scope=all` (page + `GET /api/meetings`) lists every host-validated portal link,
  unlisted ones under an "Other" group — QA / full-portal view.

## The directory block

`<MeetingSchedulerDirectory apiBaseUrl={CONTENT_PREFIX} bookingBasePath="/schedule-a-call" />`
embeds the whole LISTING experience — row cards (host avatars, title/description,
For-<audience> chip, next available time), same-shell skeleton rows, and the house
`PersistentPaginationWrapper` — in one component. Rows navigate to
`{bookingBasePath}/{slug}`; serve `<HubSpotMeetingScheduler>` there (resolve the slug
via `GET /api/meetings?slug=…`). `includeAll` renders the `scope=all` full-portal
view. Layout is stable by construction (reserved rows area + held pagination slot) —
nothing below the block jumps across loading/page changes. See the working pair in
`react-embedding-example/src/pages/schedule-a-call.tsx`.

## Props

See the sidecar (`src/components/meeting-scheduler/.index.md`) for the authoritative
props table. Highlights: `meetingId` (required), `apiBaseUrl` (default `''`),
`initialAvailability` (SSR seed), `title`/`description` (context-panel meeting copy —
the host page keeps its own h1), `hosts` (override the "meet your host" identities;
defaults to `availability.hosts`, the whitelisted display projection the host DAL builds
from its people data — names/avatars/titles only, never emails), `displayTimezone` (pin
the DISPLAY zone — rendering only, never sent upstream), `fallbackUrl` (the "Open in
HubSpot" escape hatch — also the fail-closed target when a link declares questions or
consent shapes the native form can't faithfully reproduce), `onBooked`.

The widget renders as ONE bordered card with a Calendly-anatomy split: a CONTEXT panel
(hosts, title, duration chips, timezone) and an ACTION panel (calendar + auto-selected
first available day → details form → confirmation). Panels stack on mobile — no extra
layout work needed from the embedder.

## See also

- [`EMBEDDING.md`](./EMBEDDING.md) — runtime providers and the feature catalog.
- `schemas/meeting-booking-schema` — `makeBookingSchema`, `MeetingAvailability`,
  `BookingConfirmation`, `MeetingBookingErrorCode`, `SUPPORTED_FORM_FIELD_TYPES`,
  `MAX_MONTH_OFFSET`.
- `utils/hubspot-meetings-convention` — the slug parser + label helpers.
