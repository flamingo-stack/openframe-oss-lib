'use client';

/**
 * `<TrustCenterPage>` — the full public trust center (Vanta-fed, hub-projected).
 *
 * ONE page, not tabs (2026 trust-center practice: buyers skim and Ctrl-F, and a
 * questionnaire needs a deep link per section): hero with the monitoring status
 * and the two actions, then anchored sections in reading order
 * (`TRUST_CENTER_SECTIONS`: AI & data use → compliance → controls → documents →
 * subprocessors → FAQ → questions) with a sticky section rail on desktop
 * (`StickySectionNav` + `useScrollSpy`, the vendor-page / DocViewer pattern).
 * Built ONLY from existing lib components (see `trust-center-sections.tsx`); the
 * chrome is the canonical `PageShell` + frozen `PageLayout`.
 *
 * DATA: `useSelfFetch` against `endpoint` (default `TRUST_CENTER_API_PATH`;
 * embedders pass their `/content` proxy path). `initialData` (hub SSR) skips the
 * first fetch; a visible tab re-validates after `TRUST_CENTER_CACHE_SECONDS`.
 * Controls SEARCH is answered by the server (`endpoint?q=`, debounced by
 * `TRUST_CENTER_SEARCH_DEBOUNCE_MS`); the page never filters, it only
 * highlights the rows the server returned.
 *
 * MONITORING is derived on the client AFTER HYDRATION from `syncedAt` +
 * `monitoredWindowMs` (`isTrustCenterMonitored`), against a clock re-read every
 * time the data changes — so a long-open tab flips to "Monitoring paused" on
 * revalidation. Before hydration the status is NEUTRAL (never a claim that
 * flips). The subtitle is the brand-neutral `TRUST_CENTER_TAGLINE` unless the
 * host overrides it.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from '../../embed-shims/next-navigation';
import { useDebounce } from '../../hooks/ui/use-debounce';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import {
  TRUST_CENTER_API_PATH,
  TRUST_CENTER_CACHE_SECONDS,
  TRUST_CENTER_SEARCH_DEBOUNCE_MS,
  TRUST_CENTER_SECTIONS,
  TRUST_CENTER_TAGLINE,
  TRUST_CENTER_TITLE,
  isTrustCenterMonitored,
  normalizeTrustControlQuery,
  trustCenterDocumentUrl,
  trustCenterSearchUrl,
  type TrustCenterControlSearch,
  type TrustCenterPublic,
  type TrustCenterSectionId,
} from '../../types/trust-center';
import { STICKY_HEADER_OFFSET_PX } from '../../utils/same-page-hash-nav';
import { useScrollSpy } from '../docs/use-scroll-spy';
import { FaqSection } from '../faq/faq-section';
import { PageShell } from '../layout/article-detail-layout';
import { PageLayout } from '../layout/page-layout';
import { StickySectionNav } from '../navigation/sticky-section-nav';
import { DataAttribution } from '../ui/data-attribution';
import { EntityImage } from '../ui/entity-image';
import { LoadError } from '../ui/error-state';
import { StatusIndicator } from '../ui/status-indicator';
import {
  AiSection,
  ComplianceSection,
  ContactSection,
  ControlsSection,
  DocumentRequestModal,
  DocumentsSection,
  SubprocessorsSection,
  TrustCenterSkeleton,
  TrustSection,
} from './trust-center-sections';

export interface TrustCenterPageProps {
  /** GET endpoint for the public projection. Default `TRUST_CENTER_API_PATH`. */
  endpoint?: string;
  /** Optional SSR hydrate (hub server-read) — skips the initial client fetch. */
  initialData?: TrustCenterPublic;
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container (e.g. openframe-frontend). */
  shell?: boolean;
  /** Back-button config. Default: none (a trust center is usually a top-level page). */
  backButton?: { label?: string; href?: string } | false;
  /** Page title. Default `TRUST_CENTER_TITLE`. */
  title?: string;
  /** Page subtitle. Default the brand-neutral `TRUST_CENTER_TAGLINE` (a host adds its brand here). */
  subtitle?: string;
}

/** One section's page content. Its `h2` is the `TRUST_CENTER_SECTIONS` label — never a literal here. */
interface TrustSectionView {
  lead?: string;
  render: (data: TrustCenterPublic) => ReactNode;
}

/** Sections that have content, in page order. */
function visibleSections(data: TrustCenterPublic): Array<(typeof TRUST_CENTER_SECTIONS)[number]> {
  const hasContent: Record<TrustCenterSectionId, boolean> = {
    ai: data.aiPractices.length > 0,
    compliance: data.frameworks.length > 0,
    controls: data.controlDomains.length > 0,
    documents: data.documents.length > 0,
    subprocessors: data.subprocessors.length > 0,
    faq: data.faqs.length > 0,
    contact: true,
  };
  return TRUST_CENTER_SECTIONS.filter(section => hasContent[section.id]);
}

/** How often an open page re-judges "monitored" against the clock. */
const MONITORING_CLOCK_TICK_MS = 60_000;

/**
 * The monitoring claim: neutral before mount, then monitored / paused / not
 * enabled. WHEN the data was last synced is the shared `DataAttribution` line
 * beside it, not repeated here.
 */
function monitoringStatus(
  data: TrustCenterPublic,
  hydrated: boolean,
  nowMs: number,
): { status: 'success' | 'pending' | 'missing'; label: string } {
  if (!data.connected) return { status: 'missing', label: 'Live control monitoring is not enabled yet' };
  if (!hydrated) return { status: 'missing', label: 'Controls monitored' };
  return isTrustCenterMonitored(data, nowMs)
    ? { status: 'success', label: 'Controls continuously monitored' }
    : { status: 'pending', label: 'Monitoring paused' };
}

export function TrustCenterPage({
  endpoint = TRUST_CENTER_API_PATH,
  initialData,
  shell = true,
  backButton = false,
  title = TRUST_CENTER_TITLE,
  subtitle = TRUST_CENTER_TAGLINE,
}: TrustCenterPageProps) {
  const router = useRouter();
  const { data, isLoading, error, reload } = useSelfFetch<TrustCenterPublic>(endpoint, {
    initialData,
    revalidateOnVisibleAfterMs: TRUST_CENTER_CACHE_SECONDS * 1000,
  });
  // `false` during SSR + hydration, `true` after mount — gates everything clock-dependent.
  const hydrated = useIsHydrated();
  // The clock is re-read whenever the DATA changes (React's "adjust state while
  // rendering" pattern, keyed on the data identity): a revalidated copy is judged
  // against the time it arrived, not the time the tab was opened. Only read
  // after hydration (`monitoringStatus`), so the SSR value never reaches the DOM.
  const [clock, setClock] = useState(() => ({ data, nowMs: Date.now() }));
  if (clock.data !== data) {
    setClock(() => ({ data, nowMs: Date.now() }));
  }
  const nowMs = clock.nowMs;
  // A tab left open keeps judging the same copy against the passing time, so it
  // flips to "Monitoring paused" once `syncedAt` leaves the window.
  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = setInterval(() => setClock(current => ({ ...current, nowMs: Date.now() })), MONITORING_CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [hydrated]);
  const [request, setRequest] = useState<{ open: boolean; documentTitle: string | null }>({
    open: false,
    documentTitle: null,
  });
  const [controlsQuery, setControlsQuery] = useState('');
  const searchQuery = useDebounce(normalizeTrustControlQuery(controlsQuery), TRUST_CENTER_SEARCH_DEBOUNCE_MS);
  const controlsSearch = useSelfFetch<TrustCenterControlSearch>(
    searchQuery ? trustCenterSearchUrl(endpoint, searchQuery) : null,
  );
  // Results count only when they answer what is typed NOW: while the debounce or
  // the request is pending, the list shows its loading state, never an older answer.
  const typedQuery = normalizeTrustControlQuery(controlsQuery);
  const searchAnswered =
    typedQuery === searchQuery && !controlsSearch.isLoading && controlsSearch.data?.query === searchQuery;

  const sections = useMemo(() => (data ? visibleSections(data) : []), [data]);
  const { activeSection, handleSectionClick } = useScrollSpy(sections);
  const openRequest = useCallback((documentTitle: string | null) => setRequest({ open: true, documentTitle }), []);
  const closeRequest = useCallback(() => setRequest(current => ({ ...current, open: false })), []);

  const backCfg =
    backButton === false
      ? undefined
      : { label: backButton.label ?? 'Back to home', onClick: () => router.push(backButton.href ?? '/') };

  const hasGatedDocuments = data?.documents.some(document => document.access === 'request') ?? false;
  const actions = hasGatedDocuments
    ? [{ label: 'Request access', variant: 'accent' as const, onClick: () => openRequest(null) }]
    : undefined;

  // Section id → its content. Titles come from `TRUST_CENTER_SECTIONS`; which
  // sections show comes from `visibleSections` — this map only says what each renders.
  const views: Record<TrustCenterSectionId, TrustSectionView> = {
    ai: {
      lead: 'How customer data is handled by the AI in our products.',
      render: d => <AiSection practices={d.aiPractices} />,
    },
    compliance: {
      lead: 'Frameworks we are audited against, and what is next.',
      render: d => <ComplianceSection frameworks={d.frameworks} />,
    },
    controls: {
      lead: 'Security controls currently passing in continuous monitoring (via Vanta).',
      render: d => (
        <ControlsSection
          domains={d.controlDomains}
          query={controlsQuery}
          search={{
            results: searchAnswered ? (controlsSearch.data?.controlDomains ?? null) : null,
            error: typedQuery === searchQuery && controlsSearch.error,
            onRetry: controlsSearch.reload,
          }}
          onQueryChange={setControlsQuery}
        />
      ),
    },
    documents: {
      lead: 'Public documents open directly. Gated documents are shared under NDA after one short request.',
      render: d => (
        <DocumentsSection
          documents={d.documents}
          documentUrl={document => trustCenterDocumentUrl(endpoint, document)}
          onRequest={openRequest}
        />
      ),
    },
    subprocessors: {
      lead: 'Third parties that process customer data on our behalf.',
      render: d => <SubprocessorsSection subprocessors={d.subprocessors} />,
    },
    faq: { render: d => <FaqSection initialFaqs={d.faqs} heading={null} /> },
    contact: { render: () => <ContactSection onContact={() => openRequest(null)} /> },
  };

  let body: ReactNode;
  if (error && !data) {
    body = <LoadError message="Could not load the trust center" onRetry={reload} />;
  } else if (!data) {
    body = isLoading ? <TrustCenterSkeleton /> : null;
  } else {
    const status = monitoringStatus(data, hydrated, nowMs);
    body = (
      <>
        <div className="flex flex-col gap-[var(--spacing-system-xs)] md:flex-row md:items-center md:justify-between">
          <StatusIndicator status={status.status} label={status.label} />
          {data.connected ? (
            <DataAttribution
              icon={
                data.dataSource.logoUrl ? (
                  <EntityImage
                    src={data.dataSource.logoUrl}
                    alt={data.dataSource.name}
                    fallbackText={data.dataSource.name}
                    sizeClassName="size-4"
                  />
                ) : undefined
              }
              source={data.dataSource.name}
              lastUpdated={data.syncedAt}
            />
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-[var(--spacing-system-xl)] lg:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxl)]">
            {sections.map(section => {
              const view = views[section.id];
              return (
                <TrustSection key={section.id} id={section.id} title={section.label} lead={view.lead}>
                  {view.render(data)}
                </TrustSection>
              );
            })}
          </div>

          <aside className="hidden lg:block" aria-label="Trust center sections">
            <div className="sticky" style={{ top: STICKY_HEADER_OFFSET_PX }}>
              <StickySectionNav
                sections={sections.map(section => ({ id: section.id, label: section.label }))}
                activeSection={activeSection}
                onSectionClick={handleSectionClick}
              />
            </div>
          </aside>
        </div>

        <DocumentRequestModal open={request.open} documentTitle={request.documentTitle} onClose={closeRequest} />
      </>
    );
  }

  const inner = (
    <PageLayout
      title={title}
      subtitle={subtitle}
      backButton={backCfg}
      titleSize="h1"
      titleWrap
      actions={actions}
      actionsVariant="primary-buttons"
    >
      {body}
    </PageLayout>
  );

  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
