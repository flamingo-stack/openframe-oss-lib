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
import { formatLegalDate } from '../../../utils/format';
import { FaqSection, pageFaqProps, type PageFaqSlot } from '../../faq/faq-section';
import { PageShell, PageLayout, Skeleton, TabSelector } from '../../ui';
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
  /** SSR-prepared formatted "Last Updated" label. Stable across hydration. */
  initialLastUpdatedLabel?: string | null;
  /** Override the default `/api/legal/<docType>` endpoint
   *  (reverse-proxy embedders, alternate API paths). */
  apiEndpoint?: string;
  /** Override the default markdown renderer. */
  MarkdownRenderer?: ComponentType<LegalDocumentMarkdownRendererProps>;
  /**
   * Show a switcher between every legal document the hub has published, read
   * from its list (`useLegalDocuments`), so a host with one legal route shows
   * them all and names none. `onSelect` is the host's navigation to another
   * document. Absent: no switcher (a site that links each page from its footer).
   */
  documents?: {
    /** The list endpoint. Default `/api/legal`. */
    apiEndpoint?: string;
    onSelect: (docType: string) => void;
  };
  /** Back-button config — same pattern as `DevSectionPage`. Pass `false`
   *  to hide. Default `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
  /**
   * The page's own FAQ block: the topic the page is about (stated by the host,
   * never read from its address) and where the host serves the FAQs. Rendered
   * after the page's content, inside its container. Absent: no FAQ block.
   */
  faq?: PageFaqSlot;
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

/**
 * The switcher between the hub's published legal documents. Holds its row's
 * height while the list loads; draws nothing when the list cannot be read or
 * holds a single document (the page still shows the one it was asked for).
 */
function LegalDocumentSwitcher({
  docType,
  apiEndpoint,
  onSelect,
}: {
  docType: string;
  apiEndpoint?: string;
  onSelect: (docType: string) => void;
}) {
  const { documents, isLoading } = useLegalDocuments({ apiEndpoint });
  if (isLoading) return <Skeleton className="h-10 w-full rounded-md" />;
  const published = documents.filter(doc => doc.published);
  if (published.length < 2) return null;
  return (
    <TabSelector
      variant="secondary"
      scrollable
      value={docType}
      onValueChange={onSelect}
      items={published.map(doc => ({ id: doc.docType, label: doc.title }))}
    />
  );
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
  initialLastUpdatedLabel = null,
  apiEndpoint,
  MarkdownRenderer = RichMarkdownRenderer,
  documents,
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

  const title = titleProp ?? data?.title ?? 'Legal document';
  const errorTitle = errorTitleProp ?? `Unable to load ${title}`;
  const emptyStateMessage = emptyStateMessageProp ?? `${title} is not available at this time.`;

  const fallbackLastUpdatedLabel = data?.lastSynced != null ? formatLegalDate(data.lastSynced) : null;
  const effectiveLastUpdatedLabel = initialLastUpdatedLabel ?? fallbackLastUpdatedLabel;

  // Subtitle routes through the frozen `PageLayout` `TitleBlock` (text-h2 title
  // + subtitle) — unified header across all help-center pages. A document that
  // states its own version and effective date shows those (they are what a
  // reader agreed to); one that states neither shows when it was last read
  // from its source, else the fallback description.
  const subtitle =
    legalDocumentStampLabel(data) ??
    (effectiveLastUpdatedLabel ? `Last Updated: ${effectiveLastUpdatedLabel}` : fallbackDescription);

  const inner = (
    <PageLayout title={title} subtitle={subtitle} backButton={backCfg} titleSize="h1" titleWrap>
      {documents && <LegalDocumentSwitcher docType={docType} {...documents} />}
      {data?.sourceFile && <p className="text-ods-text-secondary opacity-75 text-h6">Source: {data.sourceFile}</p>}

      <div className="flex flex-1 flex-col items-start gap-6 lg:flex-row lg:gap-10">
        <div className="flex-1">
          <div className="w-full">
            <article className="space-y-2">
              {isLoading ? (
                // Loading skeleton matching Knowledge Hub pattern
                <div className="space-y-6">
                  <div className="h-10 w-3/4 animate-pulse rounded-lg bg-ods-skeleton"></div>
                  <div className="space-y-4">
                    <div className="h-4 w-full animate-pulse rounded bg-ods-skeleton"></div>
                    <div className="h-4 w-full animate-pulse rounded bg-ods-skeleton"></div>
                    <div className="h-4 w-5/6 animate-pulse rounded bg-ods-skeleton"></div>
                  </div>
                  <div className="h-32 animate-pulse rounded-lg border border-ods-border bg-ods-card"></div>
                  <div className="space-y-4">
                    <div className="h-4 w-full animate-pulse rounded bg-ods-skeleton"></div>
                    <div className="h-4 w-4/5 animate-pulse rounded bg-ods-skeleton"></div>
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
      {faq && <FaqSection {...pageFaqProps(faq)} />}
    </PageLayout>
  );

  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
