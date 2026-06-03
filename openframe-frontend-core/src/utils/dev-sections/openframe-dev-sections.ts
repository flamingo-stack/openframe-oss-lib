/**
 * Canonical per-section metadata for the OpenFrame dev-center surfaces
 * (Roadmap / Bug-fixes & Enhancements / Releases / Onboarding Guides).
 *
 * One file co-locates every per-section value the openframe homepage
 * navigator card AND the destination full-page hero both consume —
 * icon, brief navigator description, longer hero paragraph, search
 * config (placeholder + paramKey), filter config (paramKey + options).
 *
 * Adding a 5th section is one edit here and zero edits across the
 * page files / navigator grid.
 *
 * EMBEDDER NOTE — `onboarding`:
 *   The `onboarding` entry is INERT on `hero`/`search`/`filter` because
 *   `/onboarding-guides` is owned by `OnboardingGuidesCatalogView` (a
 *   hub-side full-page view), not the shared `DevSectionView` chrome.
 *   This entry exists ONLY to drive the homepage navigator card. Any
 *   embedder iterating the registry must SKIP `onboarding` if they
 *   don't host the `/onboarding-guides` route — e.g.
 *   `Object.values(OPENFRAME_DEV_SECTIONS).filter(s => s.href !== '/onboarding-guides')`.
 *
 * SERVER-BUNDLE SAFETY:
 *   This module imports lucide-react icon components as JSX values but
 *   never RENDERS them at module load. Lib's tsup config places `utils/`
 *   in the server bundle (no `"use client"` banner), which is safe
 *   because component-function references don't execute on import.
 *   Precedent: `src/utils/platform-config.tsx` (also lucide imports,
 *   also server-bundle, also imported by route-page `metadata` exports).
 */

import { Map as MapIcon, Wrench, Rocket, GraduationCap, LifeBuoy, type LucideIcon } from 'lucide-react'
import { releaseStatusOptions } from '../../types'
import { DEV_SECTION_PARAM_KEYS } from './dev-section-param-keys'

// Roadmap status options — `as const` preserves readonly tuple typing
// across the registry boundary.
export const ROADMAP_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
] as const

// Delivery (ClickUp custom item type) filter options. `Bug` and `Request`
// are the ClickUp `custom_item_id` labels — 1008 / 1009.
export const DELIVERY_TASK_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Bug', label: 'Bug-fix' },
  { value: 'Request', label: 'Enhancement' },
] as const

// Ticket status filter for the Help Center. Lowercase wire values
// match what `/api/chat/agent/find-ticket` accepts in `body.status`
// (the route normalizes to lowercase + allowlists 'open' | 'closed'
// before threading into `findTicketExecutor`'s `selfStatus` scope).
export const TICKET_STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
] as const

export interface OpenframeDevSection {
  /** Route href the navigator card and any internal cross-link composes. */
  href: string
  icon: LucideIcon
  /** Brief copy for the homepage navigator card (≈50 char teaser). */
  navigator: {
    title: string
    description: string
  }
  /** Longer copy for the destination page hero (≈120-150 char marketing paragraph). */
  hero: {
    title: string
    description: string
  }
  /** Inline search bar configuration. */
  search: {
    /** Placeholder text shown in the search input. */
    placeholder: string
    /** URL search param the input writes on submit and the list reads on fetch. */
    paramKey: string
  } | null
  /** Filter pill row configuration. `null` when the section has no filter (e.g. onboarding-guides). */
  filter: {
    label: string
    /** URL search param the pills write and the list reads. */
    paramKey: string
    /** The option value that maps to "no filter applied". When selected,
     *  the URL param is removed instead of being set. Defaults to the
     *  first option's value if omitted — explicit field guards against
     *  brittleness if `options` is later reordered. */
    defaultValue: string
    options: readonly { value: string; label: string }[]
  } | null
}

export const OPENFRAME_DEV_SECTIONS = {
  roadmap: {
    href: '/roadmap',
    icon: MapIcon,
    navigator: {
      title: 'Development Roadmap',
      description: "What we're building next — vote on upcoming features.",
    },
    hero: {
      title: 'Development Roadmap',
      description:
        "See what's in flight, what's planned, and what's up for community vote. The entire OpenFrame roadmap is public.",
    },
    search: { placeholder: 'Search roadmap items...', paramKey: DEV_SECTION_PARAM_KEYS.search },
    filter: { label: 'Status', paramKey: DEV_SECTION_PARAM_KEYS.status, defaultValue: 'all', options: ROADMAP_STATUS_OPTIONS },
  },
  delivery: {
    href: '/bug-fixes-and-enhancements',
    icon: Wrench,
    navigator: {
      title: 'Bug-fixes & Enhancements',
      description: 'Recently shipped fixes and improvements.',
    },
    hero: {
      title: 'Bug-fixes & Enhancements',
      description:
        'A running log of fixes and improvements shipping into OpenFrame — recently completed and actively in progress.',
    },
    search: { placeholder: 'Search tasks...', paramKey: DEV_SECTION_PARAM_KEYS.search },
    filter: { label: 'Type', paramKey: DEV_SECTION_PARAM_KEYS.deliveryTaskType, defaultValue: 'all', options: DELIVERY_TASK_TYPE_OPTIONS },
  },
  releases: {
    href: '/releases',
    icon: Rocket,
    navigator: {
      title: 'Product Releases',
      description: 'Version history and release notes.',
    },
    hero: {
      title: 'Product Releases',
      description:
        'Version notes, change summaries, and stability tier (alpha / beta / stable) for every OpenFrame release.',
    },
    search: { placeholder: 'Search releases...', paramKey: DEV_SECTION_PARAM_KEYS.search },
    filter: { label: 'Status', paramKey: DEV_SECTION_PARAM_KEYS.releaseStatus, defaultValue: 'all', options: releaseStatusOptions },
  },
  onboarding: {
    href: '/onboarding-guides',
    icon: GraduationCap,
    navigator: {
      title: 'Onboarding Guides',
      description: 'Step-by-step product walkthroughs.',
    },
    hero: {
      title: 'Getting Started',
      description:
        'Step-by-step walkthroughs for getting up and running with OpenFrame — from your first device deployment to advanced integrations.',
    },
    // `search` / `filter` are intentionally null — onboarding-guides
    // uses a custom RAG-backed search dropdown (`useDocSearch`, not the
    // local text filter `DevSectionView` ships) and dynamic section
    // pills (counts vary with content, vs the static status options
    // every other dev-center surface uses). Both controls are injected
    // by the host via `DevSectionPage`'s `preControls` slot — same
    // mechanism tickets uses for its "Open a new ticket" form.
    search: null,
    filter: null,
  },
  tickets: {
    href: '/tickets',
    icon: LifeBuoy,
    navigator: {
      title: 'Help Center',
      description: 'Open and manage your support tickets.',
    },
    hero: {
      title: 'Help Center',
      description:
        'Open new tickets, follow up on existing ones, and track responses from the team — all in one place.',
    },
    search: { placeholder: 'Search your tickets...', paramKey: DEV_SECTION_PARAM_KEYS.search },
    filter: {
      label: 'Status',
      paramKey: DEV_SECTION_PARAM_KEYS.status,
      defaultValue: 'all',
      options: TICKET_STATUS_OPTIONS,
    },
  },
} as const satisfies Record<string, OpenframeDevSection>

export type OpenframeDevSectionKey = keyof typeof OPENFRAME_DEV_SECTIONS
