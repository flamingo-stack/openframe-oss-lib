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
import Link from '../../../embed-shims/next-link';
import { useRouter } from '../../../embed-shims/next-navigation';
import { FaqSection, pageFaqProps, type PageFaqSlot } from '../../faq/faq-section';
import { UnifiedSkeleton } from '../../loading/unified-skeleton';
import { PageShell, PageLayout } from '../../ui';
import { DataSyncLine } from '../../ui/data-attribution';
import { RichMarkdownRenderer } from '../../ui/markdown';
import { useLegalDocs, type LegalDocument } from './use-legal-docs';
import { useLegalDocuments } from './use-legal-documents';

export interface LegalDocumentMarkdownRendererProps {
  content: string;
  sectionIds?: Array<{ id: string; title: string; level: number }>;
  demoteMarkdownH1ToH2?: boolean;
}

export interface LegalDocumentPageProps {
  /** Document type identifier — drives the default API endpoint
   *  `/api/legal/<docType>` AND the error-log prefix. One of the types the
   *  host's list answers (`useLegalDocuments`). */
  docType: string;
  /** Heading text. Default: the title the served document carries, so a host
   *  that shows whatever the list holds states no per-document copy. */
  title?: string;
  /** Subtitle shown when the document states neither a version nor a date. */
  fallbackDescription?: string;
  /** Email shown in the error + empty-state copy. Absent: no contact line. */
  contactEmail?: string;
  /** Prompt shown above the contact link in the error state.
   *  Default "For questions about this document, please contact:". */
  errorContactPrompt?: string;
  /** Title for the error block. Default "Unable to load <title>". */
  errorTitle?: string;
  /** Sentence shown when the API returns no document.
   *  Default "<title> is not available at this time.". */
  emptyStateMessage?: string;
  /** SSR-prepared document, if available. */
  initialData?: LegalDocument | null;
  /** Override the default `/api/legal/<docType>` endpoint
   *  (reverse-proxy embedders, alternate API paths). */
  apiEndpoint?: string;
  /** Override the default markdown renderer. */
  MarkdownRenderer?: ComponentType<LegalDocumentMarkdownRendererProps>;
  /** Back-button config — same pattern as `DevSectionPage`. Pass `false`
   *  to hide. Default `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
  /**
   * The hub's list of legal documents (`GET /api/legal`). Given it, the page
   * takes the document's title and FAQ topic from the list, so a host passes
   * only the type and its endpoints and states nothing per document; the title
   * then names the document even when its text fails to load.
   */
  documentsEndpoint?: string;
  /**
   * The page's own FAQ block: the topic the page is about and where the host
   * serves the FAQs. Rendered after the page's content, inside its container.
   * Without a `topic`, the topic is the one the list (`documentsEndpoint`)
   * gives the document. Absent, or no topic known: no FAQ block.
   */
  faq?: PageFaqSlot | Omit<PageFaqSlot, 'topic'>;
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container — only the padding box renders,
   *  avoiding a nested `<main>`. */
  shell?: boolean;
}

/**
 * "Version 1.0 · Effective October 14, 2026" for a document that states them;
 * null for one that states neither. One wording for every legal surface.
 */
export function legalDocumentStampLabel(
  doc: Pick<LegalDocument, 'version' | 'effectiveDate'> | null | undefined,
): string | null {
  const parts = [
    doc?.version ? `Version ${doc.version}` : null,
    doc?.effectiveDate ? `Effective ${doc.effectiveDate}` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' \u00b7 ') : null;
}

export function LegalDocumentPage({
  docType,
  title: titleProp,
  fallbackDescription = '',
  contactEmail,
  errorContactPrompt = 'For questions about this document, please contact:',
  errorTitle: errorTitleProp,
  emptyStateMessage: emptyStateMessageProp,
  initialData = null,
  apiEndpoint,
  MarkdownRenderer = RichMarkdownRenderer,
  documentsEndpoint,
  backButton,
  faq,
  shell = true,
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

  const { documents } = useLegalDocuments({ apiEndpoint: documentsEndpoint, enabled: Boolean(documentsEndpoint) });
  const listed = documents.find(doc => doc.docType === docType);
  const title = titleProp ?? data?.title ?? listed?.title ?? 'Legal document';
  const faqTopic = faq && 'topic' in faq ? faq.topic : listed?.faqTopic;
  const faqSlot = faq && faqTopic ? { ...faq, topic: faqTopic } : null;
  const errorTitle = errorTitleProp ?? `Unable to load ${title}`;
  const emptyStateMessage = emptyStateMessageProp ?? `${title} is not available at this time.`;

  // Subtitle routes through the frozen `PageLayout` `TitleBlock` (text-h2 title
  // + subtitle) — unified header across all help-center pages. A document that
  // states its own version and effective date shows those (they are what a
  // reader agreed to), else the fallback description. When it was last read from
  // its repository is the shared sync line under the title.
  const subtitle = legalDocumentStampLabel(data) ?? fallbackDescription;

  const inner = (
    <PageLayout title={title} subtitle={subtitle} backButton={backCfg} titleSize="h1" titleWrap>
      <DataSyncLine sync={data ? { source: 'github', syncedAt: data.lastSynced } : null} loading={isLoading && !data} />

      <div className="flex flex-1 flex-col items-start gap-6 lg:flex-row lg:gap-10">
        <div className="flex-1">
          <div className="w-full">
            <article className="space-y-2">
              {isLoading ? (
                // Loading skeleton matching Knowledge Hub pattern
                <div className="space-y-6">
                  <UnifiedSkeleton className="h-10 w-3/4 rounded-lg" />
                  <div className="space-y-4">
                    <UnifiedSkeleton className="h-4 w-full rounded" />
                    <UnifiedSkeleton className="h-4 w-full rounded" />
                    <UnifiedSkeleton className="h-4 w-5/6 rounded" />
                  </div>
                  <UnifiedSkeleton className="h-32 rounded-lg border border-ods-border" />
                  <div className="space-y-4">
                    <UnifiedSkeleton className="h-4 w-full rounded" />
                    <UnifiedSkeleton className="h-4 w-4/5 rounded" />
                  </div>
                </div>
              ) : error ? (
                <div className="space-y-4 text-center">
                  <div className="rounded-lg border border-ods-error bg-ods-error-secondary p-6">
                    <p className="mb-2 text-ods-error">{errorTitle}</p>
                    <p className="text-ods-error text-h6">{error}</p>
                  </div>
                  {contactEmail && (
                    <div className="text-ods-text-secondary">
                      <p>{errorContactPrompt}</p>
                      <Link href={`mailto:${contactEmail}`} className="text-ods-accent hover:underline">
                        {contactEmail}
                      </Link>
                    </div>
                  )}
                </div>
              ) : data ? (
                <MarkdownRenderer content={data.content} sectionIds={data.sections || []} demoteMarkdownH1ToH2 />
              ) : (
                <div className="py-16 text-center text-ods-text-secondary">
                  <p className="text-h4">{emptyStateMessage}</p>
                  {contactEmail && (
                    <p className="mt-2">
                      Please contact{' '}
                      <Link href={`mailto:${contactEmail}`} className="text-ods-accent hover:underline">
                        {contactEmail}
                      </Link>{' '}
                      for more information.
                    </p>
                  )}
                </div>
              )}
            </article>
          </div>
        </div>
      </div>
      {faqSlot && <FaqSection {...pageFaqProps(faqSlot)} />}
    </PageLayout>
  );

  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
