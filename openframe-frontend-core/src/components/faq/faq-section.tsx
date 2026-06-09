"use client"

import React from 'react'
import type { Faq } from '../../types/faq'
import { FaqAccordion, type FaqItem } from '../faq-accordion'
import { useSelfFetch } from '../../hooks/use-self-fetch'
import { buildFaqJsonLdFromFaqs, type FaqSchemaOptions } from './json-ld'

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
   * Page heading. Pass null to render in embedded mode (no <h1>, error branch
   * suppresses any banner). React node so platforms can drill their local
   * <PageHeading> component without the lib referencing platform state.
   */
  heading?: React.ReactNode | null
  /** Inject FAQPage schema.org JSON-LD as a <script>. Off by default so embeds
   *  don't emit duplicate schema. */
  emitJsonLd?: boolean
  /** Overrides for the JSON-LD's name/description/url. */
  jsonLd?: FaqSchemaOptions
  className?: string
}

const DEFAULT_HEADING_TEXT = 'Frequently Asked Questions'

function buildFaqsUrl(entityType?: string, entityId?: number | string): string {
  if (!entityType || entityId === undefined || entityId === null || entityId === '') {
    return '/api/faqs'
  }
  const qs = new URLSearchParams({ entityType, entityId: String(entityId) })
  return `/api/faqs?${qs.toString()}`
}

function groupBySection(faqs: Faq[]): Array<{ section: string | null; items: FaqItem[] }> {
  const map = new Map<string, FaqItem[]>()
  for (const faq of faqs) {
    const key = faq.section || ''
    let arr = map.get(key)
    if (!arr) {
      arr = []
      map.set(key, arr)
    }
    arr.push({ id: faq.id, question: faq.question, answer: faq.answer })
  }
  return Array.from(map.entries()).map(([section, items]) => ({
    section: section || null,
    items,
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
  emitJsonLd = false,
  jsonLd,
  className,
}: FaqSectionProps) {
  const url = buildFaqsUrl(entityType, entityId)
  const initialData = initialFaqs ? { faqs: initialFaqs } : undefined
  const { data, isLoading, error } = useSelfFetch<FaqsResponse>(url, { initialData })

  const faqs = data?.faqs ?? []
  const showHeading = heading !== null
  const headingNode =
    heading === undefined
      ? <h1 className="text-h1 tracking-[-0.04em] text-ods-text-primary">{DEFAULT_HEADING_TEXT}</h1>
      : heading

  const groups = groupBySection(faqs)

  // Embedded mode (no heading): degrade silently on error.
  if (error && !showHeading) {
    return null
  }

  if (isLoading && faqs.length === 0) {
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

  return (
    <>
      <main className={className ?? 'bg-ods-bg'}>
        <div className="max-w-[1920px] px-6 md:px-20 py-6 md:py-10 mx-auto space-y-10">
          {showHeading && headingNode}
          {groups.map(({ section, items }) => (
            <div key={section || 'default'} className="space-y-4">
              {section && (
                <h2 className="text-h2 tracking-[-0.04em] text-ods-text-primary mb-3 md:mb-4">
                  {section}
                </h2>
              )}
              <FaqAccordion items={items} />
            </div>
          ))}
        </div>
      </main>
      {schema && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}
    </>
  )
}
