'use client';

/**
 * LegalDocumentPage — unified UI for privacy-policy, terms-of-service,
 * and any other markdown-backed legal document.
 *
 * Replaces two near-identical hub components (`PrivacyPolicyPage` +
 * `TermsOfServicePage`) that differed only in title, contact email,
 * and copy strings. Caller passes those as props.
 *
 * Markdown rendering: defaults to lib's `SimpleMarkdownRenderer`
 * (sufficient for plain-markdown legal docs). Embedders that need
 * richer markdown (embeds, video, OG previews) pass their own via
 * the `MarkdownRenderer` prop — same injection pattern as
 * `ReleaseDetailPage`.
 *
 * Endpoint configuration: forwarded to `useLegalDocs(docType, { apiEndpoint })`.
 */

import type { ComponentType } from 'react';
import { PageShell, PageLayout, PageHeading } from '../../ui';
import { RichMarkdownRenderer } from '../../ui/rich-markdown-renderer';
import { useRouter } from '../../../embed-shims/next-navigation';
import { useLegalDocs, type LegalDocument } from './use-legal-docs';
import { formatLegalDate } from '../../../utils/format';

export interface LegalDocumentMarkdownRendererProps {
  content: string;
  sectionIds?: Array<{ id: string; title: string; level: number }>;
  demoteMarkdownH1ToH2?: boolean;
}

export interface LegalDocumentPageProps {
  /** Document type identifier — drives the default API endpoint
   *  `/api/legal/<docType>` AND the error-log prefix. Common values:
   *  `'privacy'`, `'terms'`. Embedders may use any string. */
  docType: string;
  /** Heading text (e.g. "Privacy Policy", "Terms of Service"). */
  title: string;
  /** Fallback subtitle shown when no `lastUpdated` date is available
   *  (e.g. "Our privacy policy and data protection practices"). */
  fallbackDescription: string;
  /** Email shown in the error + empty-state copy
   *  (e.g. `'privacy@openframe.io'`, `'legal@openframe.io'`). */
  contactEmail: string;
  /** Prompt shown above the contact link in the error state
   *  (e.g. "For privacy-related questions, please contact:"). */
  errorContactPrompt: string;
  /** Title for the error block (e.g. "Unable to load privacy policy"). */
  errorTitle: string;
  /** Sentence shown when the API returns no document
   *  (e.g. "Privacy policy content is not available at this time."). */
  emptyStateMessage: string;
  /** SSR-prepared document, if available. */
  initialData?: LegalDocument | null;
  /** SSR-prepared formatted "Last Updated" label. Stable across hydration. */
  initialLastUpdatedLabel?: string | null;
  /** Override the default `/api/legal/<docType>` endpoint
   *  (reverse-proxy embedders, alternate API paths). */
  apiEndpoint?: string;
  /** Override the default markdown renderer. */
  MarkdownRenderer?: ComponentType<LegalDocumentMarkdownRendererProps>;
  /** Back-button config — same pattern as `DevSectionPage`. Pass `false`
   *  to hide. Default `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
}

export function LegalDocumentPage({
  docType,
  title,
  fallbackDescription,
  contactEmail,
  errorContactPrompt,
  errorTitle,
  emptyStateMessage,
  initialData = null,
  initialLastUpdatedLabel = null,
  apiEndpoint,
  MarkdownRenderer = RichMarkdownRenderer,
  backButton,
}: LegalDocumentPageProps) {
  const router = useRouter();
  const { data, isLoading, error } = useLegalDocs(docType, { initialData, apiEndpoint });

  // Back-button config — mirrors DevSectionPage's `{ label: 'Back to home',
  // onClick: () => router.push('/') }`. Hide entirely when caller passes
  // `false` (e.g. embed-mode where the host owns navigation chrome).
  const backCfg =
    backButton === false
      ? undefined
      : {
          label: backButton?.label ?? 'Back to home',
          onClick: () => router.push(backButton?.href ?? '/'),
        };

  const fallbackLastUpdatedLabel =
    data?.lastSynced != null ? formatLegalDate(data.lastSynced) : null;
  const effectiveLastUpdatedLabel = initialLastUpdatedLabel ?? fallbackLastUpdatedLabel;

  // Title with accent-colon trailing dot — matches knowledge-hub typography
  const customTitle = (
    <div className="flex flex-col gap-4">
      <PageHeading>
        <span>{title}</span>
        <span className="text-ods-accent">.</span>
      </PageHeading>
      <p className="font-['DM_Sans'] text-base md:text-lg text-ods-text-secondary max-w-2xl">
        {effectiveLastUpdatedLabel ? `Last Updated: ${effectiveLastUpdatedLabel}` : fallbackDescription}
        {data?.sourceFile && (
          <span className="block text-sm mt-1 opacity-75">Source: {data.sourceFile}</span>
        )}
      </p>
    </div>
  );

  return (
    <PageShell>
      <PageLayout backButton={backCfg}>
        <div className="flex flex-col gap-4">{customTitle}</div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start flex-1">
          <div className="flex-1">
            <div className="w-full">
              <article className="space-y-2">
                {isLoading ? (
                  // Loading skeleton matching Knowledge Hub pattern
                  <div className="space-y-6">
                    <div className="h-10 bg-ods-skeleton rounded-lg w-3/4 animate-pulse"></div>
                    <div className="space-y-4">
                      <div className="h-4 bg-ods-skeleton rounded w-full animate-pulse"></div>
                      <div className="h-4 bg-ods-skeleton rounded w-full animate-pulse"></div>
                      <div className="h-4 bg-ods-skeleton rounded w-5/6 animate-pulse"></div>
                    </div>
                    <div className="h-32 bg-ods-card border border-ods-border rounded-lg animate-pulse"></div>
                    <div className="space-y-4">
                      <div className="h-4 bg-ods-skeleton rounded w-full animate-pulse"></div>
                      <div className="h-4 bg-ods-skeleton rounded w-4/5 animate-pulse"></div>
                    </div>
                  </div>
                ) : error ? (
                  <div className="text-center space-y-4">
                    <div className="bg-red-900/20 border border-red-700 rounded-lg p-6">
                      <p className="text-red-400 mb-2">{errorTitle}</p>
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                    <div className="text-ods-text-secondary">
                      <p>{errorContactPrompt}</p>
                      <a href={`mailto:${contactEmail}`} className="text-ods-accent hover:underline">
                        {contactEmail}
                      </a>
                    </div>
                  </div>
                ) : data ? (
                  <MarkdownRenderer
                    content={data.content}
                    sectionIds={data.sections || []}
                    demoteMarkdownH1ToH2
                  />
                ) : (
                  <div className="text-center text-ods-text-secondary py-16">
                    <p className="text-xl">{emptyStateMessage}</p>
                    <p className="mt-2">
                      Please contact{' '}
                      <a href={`mailto:${contactEmail}`} className="text-ods-accent hover:underline">
                        {contactEmail}
                      </a>{' '}
                      for more information.
                    </p>
                  </div>
                )}
              </article>
            </div>
          </div>
        </div>
      </PageLayout>
    </PageShell>
  );
}
