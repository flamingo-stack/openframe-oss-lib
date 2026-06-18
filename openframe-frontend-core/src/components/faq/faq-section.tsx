"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Faq } from '../../types/faq'
import { FaqAccordion, type FaqItem } from '../faq-accordion'
import { useSelfFetch } from '../../hooks/use-self-fetch'
import { buildSuggestionUrl } from '../../utils/suggestion-url'
import { serializeJsonLd } from '../../utils/common'
import { scrollElementIntoView } from '../../utils/scroll-into-view'
import { faqSectionSlug, faqItemAnchor, parseFaqHash, type FaqHashTarget } from '../../utils/faq-anchor'
import { cn } from '../../utils/cn'
import { buildFaqJsonLdFromFaqs, type FaqSchemaOptions } from './json-ld'
import { SECTION_HEADING_CLASS } from '../layout/page-heading'

export interface FaqSectionProps {
  /**
   * SSR hydrate. When provided, the hook skips the first client fetch (per
   * useSelfFetch contract). The consuming server page resolves FAQs then drills
   * them into this prop — the lib never re-fetches what the host already gated on.
   */
  initialFaqs?: Faq[]
  /** Both required together for entity-attached FAQs; partial → bare /api/faqs. */
  entityType?: string
  entityId?: number | string
  /**
   * Heading node above the grouped list. `undefined` → default
   * `<h2>`"Frequently Asked Questions". `null` → no heading (the host page
   * owns the `<h1>`, as the standalone /faqs surface does). A React node lets a
   * platform drill its own <PageHeading> without the lib referencing platform
   * state. Also drives category nesting so the document outline stays correct:
   * `null` → categories render `<h2>` (directly under the page `<h1>`);
   * otherwise categories render `<h3>` beneath this heading.
   */
  heading?: React.ReactNode | null
  /** Inject FAQPage schema.org JSON-LD as a <script>. Off by default so embeds
   *  don't emit duplicate schema. */
  emitJsonLd?: boolean
  /** Overrides for the JSON-LD's name/description/url. */
  jsonLd?: FaqSchemaOptions
  className?: string
  /** Maps to /api/faqs `?count=` (the 5-tier fill target). Absent → param
   *  not sent (server default applies). */
  minResults?: number
  /** Fetch-URL prefix for third-party embeds / reverse proxies
   *  ('' = same-origin relative). */
  apiBaseUrl?: string
}

const DEFAULT_HEADING_TEXT = 'Frequently Asked Questions'

/** URL composition shared with RelatedContentSection (`buildSuggestionUrl`)
 *  — byte-identical to the historical `buildFaqsUrl` output when
 *  `minResults`/`apiBaseUrl` are absent. */
function buildFaqsUrl(
  entityType?: string,
  entityId?: number | string,
  minResults?: number,
  apiBaseUrl = '',
): string {
  return buildSuggestionUrl('/api/faqs', { apiBaseUrl, entityType, entityId, count: minResults })
}

interface FaqGroup {
  /** null → the uncategorized bucket: no heading, no jump pill, rendered last. */
  section: string | null
  slug: string | null
  items: FaqItem[]
}

/** Group FAQs by `faq.section`, preserving the server's first-seen
 *  (display_order) order for BOTH the section order and the rows within each
 *  section. The uncategorized bucket (blank/missing section) sinks to the end
 *  since it renders without a heading. Items carry NO badge here — the `<h2>`
 *  IS the category, so a per-row chip would be redundant. */
function groupFaqsBySection(faqs: Faq[]): FaqGroup[] {
  const order: string[] = []
  const byName = new Map<string, FaqGroup>()
  let uncategorized: FaqGroup | null = null
  for (const faq of faqs) {
    const item: FaqItem = { id: faq.id, question: faq.question, answer: faq.answer }
    const name = faq.section?.trim()
    if (!name) {
      if (!uncategorized) uncategorized = { section: null, slug: null, items: [] }
      uncategorized.items.push(item)
      continue
    }
    let group = byName.get(name)
    if (!group) {
      group = { section: name, slug: faqSectionSlug(name), items: [] }
      byName.set(name, group)
      order.push(name)
    }
    group.items.push(item)
  }
  const groups = order.map((name) => byName.get(name)!)
  if (uncategorized) groups.push(uncategorized)
  return groups
}

/** The standard hub sticky-header height — same offset `useNavLink`'s hash
 *  scroll uses, so a category jump lands below the header, not under it. */
const FAQ_NAV_HEADER_OFFSET = 96

/** Map key for the uncategorized bucket — `group.slug` is null for it, so
 *  every per-group map (default-open ids, accordion keys) uses this sentinel
 *  to keep the lookup typed. */
const UNCATEGORIZED_KEY = '__uncategorized__'
const groupKey = (g: FaqGroup): string => g.slug ?? UNCATEGORIZED_KEY

/**
 * Grouped FAQ layout: a category jump-nav above stacked `<h2>` category
 * sections (each its own accordion). Isolated into its own component so the
 * scroll-spy hooks only mount in grouped mode — `FaqSection`'s own hooks stay
 * unconditional.
 *
 * The pills are real `<a href="#slug">` anchors (crawlable in-page links,
 * deep-linkable, work without JS); the click handler upgrades the jump to the
 * cancellation-proof `scrollElementIntoView` tween and syncs the URL hash.
 */
function GroupedFaqList({
  groups,
  categoryHeadingAs,
}: {
  groups: FaqGroup[]
  /** Heading tag for each category, so the document outline nests correctly
   *  under whatever owns the heading above this block: `h2` on the standalone
   *  page (the page owns the `<h1>`), `h3` beneath an embed's `<h2>` title.
   *  The VISUAL is `SECTION_HEADING_CLASS` either way, so categories look
   *  identical on every surface. */
  categoryHeadingAs: 'h2' | 'h3'
}) {
  const CategoryHeading = categoryHeadingAs
  const navGroups = useMemo(() => groups.filter((g) => g.slug), [groups])
  const [activeSlug, setActiveSlug] = useState<string | null>(navGroups[0]?.slug ?? null)
  // Identity-stable key for the section set so the observer re-binds only when
  // the categories actually change (not on every parent re-render).
  const slugKey = navGroups.map((g) => g.slug).join('|')

  // Scroll-spy: mark the pill for the category currently at the top of the
  // viewport. rootMargin drops the trigger line just below the sticky header
  // and ignores the bottom ~55% so "active" is the section being read, not the
  // next one peeking in.
  useEffect(() => {
    if (navGroups.length < 2) return
    const tops = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id
          if (entry.isIntersecting) tops.set(id, entry.boundingClientRect.top)
          else tops.delete(id)
        }
        let bestId: string | null = null
        let bestTop = Number.POSITIVE_INFINITY
        for (const [id, top] of tops) {
          if (top < bestTop) {
            bestTop = top
            bestId = id
          }
        }
        if (bestId) setActiveSlug(bestId)
      },
      { rootMargin: `-${FAQ_NAV_HEADER_OFFSET}px 0px -55% 0px`, threshold: 0 },
    )
    for (const group of navGroups) {
      const el = group.slug ? document.getElementById(group.slug) : null
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // slugKey encodes the section set; re-observe only when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugKey])

  // ─── Hash dispatch — `/faqs#faq-item-<id>` or `/faqs#faq-<section-slug>` ──
  // Tracks the current hash so:
  //   1. an item-kind hash seeds `defaultOpenIds` on the matching accordion
  //      (auto-expands the cited question);
  //   2. either kind triggers the cancellation-proof tween scroll with the
  //      sticky-header offset (native browser hash scroll runs once, ignores
  //      our offset — re-running the tween puts the target in the right spot).
  // Listens to `hashchange` so back/forward replays the same behavior. SSR-
  // safe: initial null state matches the server render; the first effect
  // tick on the client updates it.
  const [hashTarget, setHashTarget] = useState<FaqHashTarget | null>(null)
  useEffect(() => {
    const refresh = () => setHashTarget(parseFaqHash(window.location.hash))
    refresh()
    window.addEventListener('hashchange', refresh)
    return () => window.removeEventListener('hashchange', refresh)
  }, [])

  // Per-group default-open set when the hash points at an item. The map key
  // matches `groupKey(group)` so the render-time lookup is O(1) per group.
  const defaultOpenByGroupKey = useMemo(() => {
    if (hashTarget?.kind !== 'item') return null
    const targetId = hashTarget.rawId
    const result = new Map<string, (string | number)[]>()
    for (const group of groups) {
      const hit = group.items.find((i) => String(i.id) === targetId)
      if (hit) result.set(groupKey(group), [hit.id])
    }
    return result.size > 0 ? result : null
  }, [groups, hashTarget])

  // Accordion is uncontrolled — `defaultOpenIds` is only consumed at mount,
  // so a new item hash needs a remount to honor it. Keying off the item-id
  // suffix triggers exactly the remount we need (and stays stable when the
  // hash points at a section, so category navigation never disturbs the
  // accordion's open state).
  const accordionKeySuffix =
    hashTarget?.kind === 'item' ? `item:${hashTarget.rawId}` : 'default'

  useEffect(() => {
    if (!hashTarget) return
    const elId =
      hashTarget.kind === 'item' ? faqItemAnchor(hashTarget.rawId) : hashTarget.slug
    const el = document.getElementById(elId)
    if (el) scrollElementIntoView(el, { headerOffset: FAQ_NAV_HEADER_OFFSET })
    if (hashTarget.kind === 'section') setActiveSlug(hashTarget.slug)
  }, [hashTarget])

  const handleJump = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
      e.preventDefault()
      setActiveSlug(slug)
      scrollElementIntoView(document.getElementById(slug), {
        headerOffset: FAQ_NAV_HEADER_OFFSET,
      })
      if (typeof history !== 'undefined') history.replaceState(null, '', `#${slug}`)
    },
    [],
  )

  return (
    <div className="space-y-8">
      {navGroups.length > 1 && (
        <nav aria-label="FAQ categories" className="flex flex-wrap gap-2">
          {navGroups.map((group) => {
            const isActive = group.slug === activeSlug
            return (
              <a
                key={group.slug}
                href={`#${group.slug}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={(e) => handleJump(e, group.slug as string)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium font-['DM_Sans'] transition-colors",
                  isActive
                    ? 'border-ods-text-primary bg-ods-card text-ods-text-primary'
                    : 'border-ods-border bg-ods-card text-ods-text-secondary hover:border-ods-text-secondary hover:text-ods-text-primary',
                )}
              >
                {group.section}
              </a>
            )
          })}
        </nav>
      )}
      <div className="space-y-10">
        {groups.map((group) => {
          const key = groupKey(group)
          return (
            <section
              key={key}
              id={group.slug ?? undefined}
              className="scroll-mt-24 space-y-4"
            >
              {group.section && (
                <CategoryHeading className={SECTION_HEADING_CLASS}>{group.section}</CategoryHeading>
              )}
              <FaqAccordion
                // Re-key on item-hash changes so the remount picks up the new
                // `defaultOpenIds` (the accordion is uncontrolled). Stable for
                // section hashes — category navigation doesn't disturb state.
                key={`${key}:${accordionKeySuffix}`}
                items={group.items}
                defaultOpenIds={defaultOpenByGroupKey?.get(key)}
              />
            </section>
          )
        })}
      </div>
    </div>
  )
}

function FaqSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-12 md:h-14 w-2/3 rounded bg-ods-border" />
      <div className="rounded-3xl border border-ods-border overflow-hidden bg-ods-card divide-y divide-ods-border w-full">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="flex items-center justify-between px-6 md:px-8 py-6">
            <div className="h-6 w-5/6 rounded bg-ods-border" />
            <div className="h-10 w-10 rounded-md bg-ods-border" />
          </div>
        ))}
      </div>
    </div>
  )
}

interface FaqsResponse {
  faqs: Faq[]
}

/**
 * The FAQ display surface — ONE rendering on every host: the list grouped by
 * `faq.section` (each category a heading + its own accordion, with a category
 * jump-nav once there are 2+ categories). There is no flat/ungrouped mode and
 * no page-vs-embedded shell fork; the standalone /faqs page and every embed
 * render through this single path, so they cannot drift.
 *
 * - Standalone /faqs page: pass `initialFaqs` (SSR) + `heading={null}` (the
 *   page owns the <h1>) + `emitJsonLd` with `jsonLd` overrides for SEO.
 * - Per-entity embed: pass `entityType` + `entityId` (no `initialFaqs`); the
 *   hook self-fetches `GET /api/faqs`, and `heading` is this block's own <h2>.
 *
 * CONTRACT: the consuming app MUST implement `GET /api/faqs`. On a fetch error
 * (or zero FAQs) the component renders nothing so the host page isn't
 * disfigured. The host always supplies the page shell — this renders a bare
 * <section>.
 */
export function FaqSection({
  initialFaqs,
  entityType,
  entityId,
  heading,
  emitJsonLd = false,
  jsonLd,
  className,
  minResults,
  apiBaseUrl = '',
}: FaqSectionProps) {
  const url = buildFaqsUrl(entityType, entityId, minResults, apiBaseUrl)
  // Memoized — useSelfFetch re-syncs on [initialData]; a fresh per-render
  // wrapper object would setState-loop under re-rendering parents.
  const initialData = useMemo<FaqsResponse | undefined>(
    () => (initialFaqs ? { faqs: initialFaqs } : undefined),
    [initialFaqs],
  )
  const { data, isLoading, error } = useSelfFetch<FaqsResponse>(url, { initialData })

  const faqs = data?.faqs ?? []
  // Grouped before the early returns so the hook order stays stable.
  const groups = useMemo(() => (faqs.length > 0 ? groupFaqsBySection(faqs) : []), [faqs])

  // `undefined` → default <h2> title; `null` → the host page owns the <h1>, so
  // no title renders here. `heading === null` also makes the category headings
  // <h2> (directly under the page <h1>); otherwise they nest as <h3>.
  const headingNode =
    heading === undefined ? <h2 className={SECTION_HEADING_CLASS}>{DEFAULT_HEADING_TEXT}</h2> : heading

  // Degrade silently — never show an error banner or an empty section shell
  // where FAQs would be (host pages and the standalone surface both rely on it).
  if (error) return null
  if (!isLoading && faqs.length === 0) return null
  if (isLoading && faqs.length === 0) {
    return (
      <div className={className}>
        <FaqSkeleton />
      </div>
    )
  }

  const schema = emitJsonLd ? buildFaqJsonLdFromFaqs(faqs, jsonLd) : null

  return (
    <>
      <section className={className ?? 'space-y-10'}>
        {headingNode}
        <GroupedFaqList groups={groups} categoryHeadingAs={heading === null ? 'h2' : 'h3'} />
      </section>
      {schema && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          // serializeJsonLd, NOT raw JSON.stringify — FAQ answers are
          // admin-entered; an embedded "</script>" must not break the tag.
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }}
        />
      )}
    </>
  )
}
