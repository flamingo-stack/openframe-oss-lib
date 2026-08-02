# Embedding the Meeting Scheduler (`<HubSpotMeetingScheduler>`)

A natively-branded booking flow over the HubSpot Meetings scheduler — duration → slot →
details → confirmation — rendered entirely with the lib's ODS primitives. **No iframe, no
HubSpot chrome, no third-party scripts**: every color, font, and control is yours.

The widget talks ONLY to a **host proxy** (your backend), never to HubSpot directly — the
HubSpot private-app token stays server-side, and the availability/booking payloads reach
the browser pre-sanitized.

## What it is

```
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
      fallbackUrl="https://meetings.hubspot.com/some-one/call-sales--demo"
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
      fallbackUrl="https://meetings.hubspot.com/some-one/call-sales--demo"
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

A HubSpot scheduling link participates in the directory iff its **last slug segment**
starts with `call-` (the executable parser is `utils/hubspot-meetings-convention` —
this table describes it, the parser decides).

**PRIMARY form — single dashes only.** HubSpot's slug editor rejects `--`, so the
UI-typeable shape is `call-<purpose>[-<descriptor…>]`: the FIRST token after `call-`
is the purpose (one word), everything after the next dash is the descriptor:

| Slug (last segment) | Example | Result |
|---|---|---|
| `call-<purpose>` | `vlad-m/call-marketing` | purpose `marketing` |
| `call-<purpose>-<descriptor…>` | `michael-assraf/call-sales-openframe-demo` | purpose `sales`, descriptor `openframe-demo` |
| group link | `call-support-triage` | purpose `support`, descriptor `triage` |
| `call`, `call-` | — | rejected (logged as a near-miss by the hub) |
| anything else | `michael-assraf` (personal default) | ignored |

**Alternate form** (API-created links / portals that allow `--`):
`call-<multi-word-purpose>--<descriptor>` — the `--` split wins when present, which
is the only way a purpose can itself contain dashes (`call-customer-success--kickoff`
→ purpose `customer-success` → "Customer Success"). In the single-dash form,
purposes are ONE word by design.

- Purposes are **fully dynamic** — the first `call-partnerships-intro` link mints a
  "Partnerships" tab with zero code. The `call-` marker is what keeps that junk-free.
- Name links `"Title | Short description"` — the part after `|` becomes the card
  description. An enabled **welcome screen** (per-link HubSpot toggle) wins over the name.
- Keep descriptors unique within a purpose — they disambiguate cards with identical
  titles (colliding pairs get the organizer segment appended server-side).
- Personal vs team badge comes from the link's `type` (`PERSONAL_LINK` vs
  `GROUP_CALENDAR`/`ROUND_ROBIN`), never from the slug.

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
