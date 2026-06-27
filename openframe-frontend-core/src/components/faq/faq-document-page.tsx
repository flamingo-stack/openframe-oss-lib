'use client';

/**
 * FaqDocumentPage — the full `/faqs` page with chrome, so embedders drop in
 * ONE component instead of hand-assembling `PageShell` + `PageLayout` around
 * the bare `<FaqSection>`. Mirrors `LegalDocumentPage` / `DevSectionPage`: the
 * page-level layout lives in the lib, the host page is a thin wrapper that
 * passes only config + the SSR-resolved data.
 *
 * HERO: the title + subtitle route through the canonical (frozen) `PageLayout`
 * `TitleBlock` with `titleSize="h1"` — the unified Help Center header (the
 * `TitleBlock` element is always an `<h1>`; `titleSize` only sets its typography,
 * here `text-h1`). The page owns that `<h1>`, so `<FaqSection heading={null}>`
 * nests its category headings as `<h2>`/`<h3>` (the SEO-recommended FAQ document
 * outline).
 *
 * DATA: pass `initialFaqs` (SSR-resolved, platform-scoped) so `FaqSection`
 * skips its client self-fetch — the standalone page's static platform-only
 * contract. Omit it for embeds that want the self-fetching `/api/faqs`
 * suggestion-fill instead.
 */

import type { Faq } from '../../types/faq';
import { PageShell, PageLayout } from '../ui';
import { useRouter } from '../../embed-shims/next-navigation';
import { FaqSection } from './faq-section';
import type { FaqSchemaOptions } from './json-ld';

export interface FaqDocumentPageProps {
  /** Page title (frozen `PageLayout` `TitleBlock`). Default "Frequently Asked Questions". */
  title?: string;
  /** Subtitle under the title. */
  subtitle?: string;
  /** Back-button config — same pattern as `DevSectionPage` / `LegalDocumentPage`.
   *  Pass `false` to hide. Default `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
  /** Render the standalone `<PageShell>` (own `<main>` + bg + max-width). Default
   *  true. Pass false when the host layout already provides the page container
   *  (e.g. openframe-frontend's `AppLayout` `<main>`) — only the padding box
   *  renders, avoiding a nested `<main>`. */
  shell?: boolean;
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
  backButton,
  initialFaqs,
  emitJsonLd,
  jsonLd,
  apiBaseUrl,
  entityType,
  entityId,
  minResults,
  shell = true,
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

  const inner = (
    <PageLayout title={title} subtitle={subtitle} backButton={backCfg} titleSize="h1">
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
    </PageLayout>
  );

  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
