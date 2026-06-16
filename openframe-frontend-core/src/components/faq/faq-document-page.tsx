'use client';

/**
 * FaqDocumentPage — the full `/faqs` page with chrome, so embedders drop in
 * ONE component instead of hand-assembling `PageShell` + `PageLayout` around the
 * bare `<FaqSection>`. Mirrors `LegalDocumentPage` / `DevSectionPage`: the
 * page-level layout lives in the lib, the host passes only config + a back button.
 *
 * `<FaqSection heading={null}>` lets `PageLayout`'s `TitleBlock` own the heading +
 * back button; it self-fetches `${apiBaseUrl}/api/faqs` via the authed
 * `useSelfFetch`, and renders nothing on a fetch error or zero FAQs.
 */

import { PageShell, PageLayout } from '../ui';
import { useRouter } from '../../embed-shims/next-navigation';
import { FaqSection } from './faq-section';

export interface FaqDocumentPageProps {
  /** Page title (PageLayout TitleBlock). Default "FAQs". */
  title?: string;
  /** Subtitle under the title. */
  subtitle?: string;
  /** Back-button config — same pattern as `DevSectionPage` / `LegalDocumentPage`.
   *  Pass `false` to hide. Default `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
  /** Base URL `FaqSection` appends `/api/faqs` to (reverse-proxy embedders). */
  apiBaseUrl?: string;
  /** Optional entity scoping forwarded to `FaqSection`. */
  entityType?: string;
  entityId?: number | string;
  /** Minimum FAQ count before the section renders (forwarded to `FaqSection`). */
  minResults?: number;
}

export function FaqDocumentPage({
  title = 'FAQs',
  subtitle,
  backButton,
  apiBaseUrl,
  entityType,
  entityId,
  minResults,
}: FaqDocumentPageProps) {
  const router = useRouter();

  // Back-button config — mirrors LegalDocumentPage/DevSectionPage. Hide entirely
  // when the caller passes `false` (embed-mode where the host owns nav chrome).
  const backCfg =
    backButton === false
      ? undefined
      : {
          label: backButton?.label ?? 'Back to home',
          onClick: () => router.push(backButton?.href ?? '/'),
        };

  return (
    <PageShell>
      <PageLayout title={title} subtitle={subtitle} backButton={backCfg}>
        <FaqSection
          heading={null}
          apiBaseUrl={apiBaseUrl}
          entityType={entityType}
          entityId={entityId}
          minResults={minResults}
        />
      </PageLayout>
    </PageShell>
  );
}
