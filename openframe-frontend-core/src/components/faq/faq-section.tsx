"use client"

import React, { useMemo } from 'react'
import type { Faq } from '../../types/faq'
import { FaqAccordion, type FaqItem } from '../faq-accordion'
import { useSelfFetch } from '../../hooks/use-self-fetch'
import { buildSuggestionUrl } from '../../utils/suggestion-url'
import { serializeJsonLd } from '../../utils/common'
import { buildFaqJsonLdFromFaqs, type FaqSchemaOptions } from './json-ld'
import { PAGE_HEADING_CLASS, SECTION_HEADING_CLASS } from '../layout/page-heading'

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
   * Heading node. `undefined` → variant default (page: <h1>, embedded: <h2>
   * "Frequently Asked Questions"); `null` → no heading. React node so
   * platforms can drill their local <PageHeading> component without the lib
   * referencing platform state.
   */
  heading?: React.ReactNode | null
  /**
   * Shell variant — the FAQ LIST itself renders identically everywhere (ONE
   * flat accordion, `faq.section` as a per-row chip, never a heading):
   *   - 'page' — the standalone /faqs surface: <main> shell + page gutters,
   *     default <h1> heading.
   *   - 'embedded' — a section inside a host page (entity detail rails, the
   *     global nested-page block): bare <section>, default <h2> heading.
   * Back-compat default: `heading === null` → 'embedded', else 'page' (the
   * pre-variant discriminator).
   */
  variant?: 'page' | 'embedded'
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

/** ONE list shape for every surface — standalone /faqs and embeds render the
 *  IDENTICAL flat accordion (`faq.section` = per-row chip, never a heading),
 *  so the two can't drift visually. */
function toAccordionItems(faqs: Faq[]): FaqItem[] {
  return faqs.map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    badge: faq.section || undefined,
  }))
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
 * Generic, embeddable FAQ display surface.
 *
 * - Standalone /faqs page: pass `initialFaqs` from the server + `heading` +
 *   `emitJsonLd` with `jsonLd` overrides for SEO.
 * - Per-entity embed: pass `entityType` + `entityId` (no `initialFaqs`); the
 *   hook self-fetches and the public /api/faqs endpoint picks override-vs-fallback.
 *
 * CONTRACT: the consuming app MUST implement `GET /api/faqs`. Without it,
 * useSelfFetch reports `error:true` (logged once); in embedded mode (heading
 * === null) this component renders nothing so the host page isn't disfigured.
 */
export function FaqSection({
  initialFaqs,
  entityType,
  entityId,
  heading,
  variant,
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
  const isEmbedded = variant ? variant === 'embedded' : heading === null
  const headingNode =
    heading === undefined ? (
      isEmbedded ? (
        // Embedded default is an <h2> — a host page already owns the <h1>,
        // and the schema/heading pair must read "Frequently Asked Questions"
        // (one FAQ heading per page, never tag/section names).
        <h2 className={SECTION_HEADING_CLASS}>{DEFAULT_HEADING_TEXT}</h2>
      ) : (
        <h1 className={PAGE_HEADING_CLASS}>{DEFAULT_HEADING_TEXT}</h1>
      )
    ) : (
      heading
    )

  // Embedded mode: degrade silently on error.
  if (error && isEmbedded) {
    return null
  }

  // Embedded mode, zero FAQs after load: render nothing — an embedded host
  // page (blog/case-study detail) must not show an empty section shell.
  // The standalone /faqs page keeps its existing behavior.
  if (!isLoading && !error && faqs.length === 0 && isEmbedded) {
    return null
  }

  if (isLoading && faqs.length === 0) {
    // Embedded mode renders skeletons WITHOUT the standalone page shell —
    // a host detail page already provides <main> + gutters; nesting them
    // here would emit invalid markup and double padding.
    if (isEmbedded) {
      return (
        <div className={className}>
          <FaqSkeleton />
        </div>
      )
    }
    return (
      <main className={className ?? 'bg-ods-bg'}>
        <div className="max-w-[1920px] px-6 md:px-20 py-6 md:py-10 mx-auto">
          <FaqSkeleton />
        </div>
      </main>
    )
  }

  if (error && faqs.length === 0) {
    return (
      <main className={className ?? 'bg-ods-bg flex items-center justify-center py-20'}>
        <p className="text-ods-text-primary font-medium">Failed to load FAQs. Please try again later.</p>
      </main>
    )
  }

  const schema = emitJsonLd ? buildFaqJsonLdFromFaqs(faqs, jsonLd) : null

  // ONE flat accordion on EVERY surface — `faq.section` becomes a per-row
  // chip, NOT a heading, so the page outline stays heading + h3(questions).
  // Order is the server's (post-specific first, then reused) — grouping by
  // section here would destroy it. The variants differ ONLY in shell:
  // standalone /faqs keeps its <main> + page gutters, embeds render bare.
  const accordion = <FaqAccordion items={toAccordionItems(faqs)} />
  const body = isEmbedded ? (
    <section className={className ?? 'space-y-10'}>
      {headingNode}
      {accordion}
    </section>
  ) : (
    <main className={className ?? 'bg-ods-bg'}>
      <div className="max-w-[1920px] px-6 md:px-20 py-6 md:py-10 mx-auto space-y-10">
        {headingNode}
        {accordion}
      </div>
    </main>
  )

  return (
    <>
      {body}
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
