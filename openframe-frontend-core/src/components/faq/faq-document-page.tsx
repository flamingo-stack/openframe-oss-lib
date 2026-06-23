'use client';

/**
 * FaqDocumentPage — the full `/faqs` page with chrome, so embedders drop in
 * ONE component instead of hand-assembling `PageShell` + `PageLayout` + the
 * FAQ hero around the bare `<FaqSection>`. Mirrors `LegalDocumentPage` /
 * `DevSectionPage`: the page-level layout lives in the lib, the host page is a
 * thin wrapper that passes only config + the SSR-resolved data.
 *
 * HERO: renders the canonical FAQ hero (`<h1 class="text-h1">` + accent dot +
 * icon + clamped subtitle) — byte-identical to the multi-platform hub's local
 * `PageWithHeader` chrome the standalone `/faqs` page historically used. It
 * does NOT route through `PageLayout`'s `title`/`subtitle` (the FROZEN
 * `text-h2` `TitleBlock` is a different, smaller header used by OpenFrame
 * detail surfaces). The page owns the `<h1>`, so `<FaqSection heading={null}>`
 * nests its category headings as `<h2>` and the questions as `<h3>` (the
 * SEO-recommended FAQ document outline).
 *
 * DATA: pass `initialFaqs` (SSR-resolved, platform-scoped) so `FaqSection`
 * skips its client self-fetch — the standalone page's static platform-only
 * contract. Omit it for embeds that want the self-fetching `/api/faqs`
 * suggestion-fill instead.
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { Faq } from '../../types/faq';
import { PageShell, PageLayout } from '../ui';
import { useRouter } from '../../embed-shims/next-navigation';
import { SECTION_HERO_ICON_CLASS } from '../../utils/page-header-constants';
import { FaqSection } from './faq-section';
import type { FaqSchemaOptions } from './json-ld';

export interface FaqDocumentPageProps {
  /** Hero `<h1>`. Default "Frequently Asked Questions". */
  title?: string;
  /** Subtitle under the title (auto-clamped to 2 lines). */
  subtitle?: string;
  /** Icon rendered before the title. Default `<HelpCircle>` (the FAQ glyph). */
  titleIcon?: React.ReactNode;
  /** Render the yellow accent dot after the title (default true). */
  accentDot?: boolean;
  /** Back-button config — same pattern as `DevSectionPage` / `LegalDocumentPage`.
   *  Pass `false` to hide. Default `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
  /** SSR-hydrate `FaqSection` (skips the client fetch — the platform-only
   *  contract for the standalone page). Omit for self-fetching embeds. */
  initialFaqs?: Faq[];
  /** Emit FAQPage schema.org JSON-LD (forwarded to `FaqSection`). Off by
   *  default so embeds don't emit duplicate schema. */
  emitJsonLd?: boolean;
  /** JSON-LD name/description/url overrides (forwarded to `FaqSection`). */
  jsonLd?: FaqSchemaOptions;
  /** Base URL `FaqSection` appends `/api/faqs` to (reverse-proxy embedders). */
  apiBaseUrl?: string;
  /** Optional entity scoping forwarded to `FaqSection`. */
  entityType?: string;
  entityId?: number | string;
  /** Minimum FAQ count before the section renders (forwarded to `FaqSection`). */
  minResults?: number;
}

export function FaqDocumentPage({
  title = 'Frequently Asked Questions',
  subtitle,
  titleIcon = <HelpCircle className={SECTION_HERO_ICON_CLASS} />,
  accentDot = true,
  backButton,
  initialFaqs,
  emitJsonLd,
  jsonLd,
  apiBaseUrl,
  entityType,
  entityId,
  minResults,
}: FaqDocumentPageProps) {
  const router = useRouter();

  // Back-button config — mirrors LegalDocumentPage / DevSectionPage. Hide
  // entirely when the caller passes `false` (embed-mode where the host owns
  // nav chrome).
  const backCfg =
    backButton === false
      ? undefined
      : {
          label: backButton?.label ?? 'Back to home',
          onClick: () => router.push(backButton?.href ?? '/'),
        };

  return (
    <PageShell>
      <PageLayout backButton={backCfg}>
        <div className="w-full flex flex-col gap-10">
          {/* Canonical FAQ hero — the exact DOM/CSS the hub's local
              `PageWithHeader` rendered (text-h1 + accent dot + icon + clamped
              subtitle), inlined here so the standalone `/faqs` look is owned by
              the lib. Intentionally NOT the frozen `text-h2` `TitleBlock`. */}
          <div className="flex items-end justify-between gap-[var(--spacing-system-m)] md:flex-col md:items-start md:justify-start lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-[var(--spacing-system-xs)] flex-1 min-w-0">
              <div className="space-y-4">
                <h1 className="text-h1 tracking-[-1.12px] text-ods-text-primary flex items-center gap-3">
                  {titleIcon}
                  <span>
                    {title}
                    {accentDot && <span className="text-ods-accent">.</span>}
                  </span>
                </h1>
                <p className="font-['DM_Sans'] font-medium text-[18px] leading-[28px] text-ods-text-secondary max-w-3xl line-clamp-2 min-h-[56px]">
                  {subtitle || ' '}
                </p>
              </div>
            </div>
          </div>
          <FaqSection
            initialFaqs={initialFaqs}
            heading={null}
            emitJsonLd={emitJsonLd}
            jsonLd={jsonLd}
            apiBaseUrl={apiBaseUrl}
            entityType={entityType}
            entityId={entityId}
            minResults={minResults}
          />
        </div>
      </PageLayout>
    </PageShell>
  );
}
