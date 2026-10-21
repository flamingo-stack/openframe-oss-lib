'use client';

/**
 * `<TrustCenterPage>` — the full public trust center (Vanta-fed, hub-projected).
 *
 * ONE page, not tabs (2026 trust-center practice: buyers skim and Ctrl-F, and a
 * questionnaire needs a deep link per section): hero with the monitoring status
 * (with the page's PDF as a quiet link at its end) and the Request access action, then anchored sections in reading order
 * (`TRUST_CENTER_SECTIONS`: compliance → controls → documents → subprocessors →
 * AI & data use → contact → FAQ) with a sticky section rail on desktop
 * (`StickySectionNav` + `useScrollSpy`, the vendor-page / DocViewer pattern).
 * Built ONLY from existing lib components (see `trust-center-sections.tsx`); the
 * chrome is the canonical `PageShell` + frozen `PageLayout`.
 *
 * DATA: `useSelfFetch` against `endpoint` (default `TRUST_CENTER_API_PATH`;
 * embedders pass their `/content` proxy path). `initialData` (hub SSR) skips the
 * first fetch; a visible tab re-validates after `TRUST_CENTER_CACHE_SECONDS`.
 * CONTROLS are answered by the server (`endpoint/controls?domain=&q=`) per tab
 * and per search; the page never filters, it only highlights what came back.
 *
 * MONITORING is derived on the client AFTER HYDRATION from `syncedAt` +
 * `monitoredWindowMs` (`isTrustCenterMonitored`), against a clock re-read every
 * time the data changes — so a long-open tab flips to "Monitoring paused" on
 * revalidation. Before hydration the status is NEUTRAL (never a claim that
 * flips). The subtitle is the brand-neutral `TRUST_CENTER_TAGLINE` unless the
 * host overrides it.
 *
 * LOADING: the page is its own loading state. While the projection is read (or in a host's loading scope) it renders
 * the SAME view over an empty projection (`EMPTY_TRUST_CENTER`) inside a `LoadingScope`, every section shown: each
 * section's component draws its own skeleton, static copy (headings, leads, Contact, the rail) is real.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from '../../embed-shims/next-navigation';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useScrollToHash } from '../../hooks/use-scroll-to-hash';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import {
  TRUST_CENTER_API_PATH,
  TRUST_CENTER_CACHE_SECONDS,
  TRUST_CENTER_TAGLINE,
  TRUST_CENTER_SECTIONS,
  TRUST_CENTER_TITLE,
  trustCenterMonitoringStatus,
  trustCenterDocumentUrl,
  trustCenterPdfUrl,
  visibleTrustCenterSections,
  type TrustCenterControlsPage,
  type TrustCenterPublic,
  type TrustCenterSectionId,
} from '../../types/trust-center';
import { STICKY_HEADER_OFFSET_PX } from '../../utils/same-page-hash-nav';
import { useScrollSpy } from '../docs/use-scroll-spy';
import { FaqSection, type FaqSectionProps, type FaqSkeletonShape } from '../faq/faq-section';
import { PageShell } from '../layout/article-detail-layout';
import { PageLayout } from '../layout/page-layout';
import { LoadingFallback } from '../loading/loading-fallback';
import { StickySectionNav } from '../navigation/sticky-section-nav';
import { DataAttribution } from '../ui/data-attribution';
import { DownloadButton } from '../ui/download-button';
import { EntityImage } from '../ui/entity-image';
import { LoadError } from '../ui/error-state';
import { LoadingScope, useLoadingScope } from '../ui/loading-scope';
import { StatusIndicator } from '../ui/status-indicator';
import {
  AiSection,
  ComplianceSection,
  ContactSection,
  ControlsSection,
  DocumentRequestModal,
  DocumentsSection,
  SubprocessorsSection,
  TRUST_BODY_GRID_CLASS,
  TRUST_SECTIONS_COLUMN_CLASS,
  TRUST_SECTION_LEADS,
  TRUST_STATUS_ROW_CLASS,
  type TrustCenterPanelId,
  type TrustPanelRows,
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
  /** The FAQ section's "ask the assistant" card (`FaqSection`'s `ask`): the host states its topic. Absent: no card. */
  ask?: FaqSectionProps['ask'];
  /**
   * Host content shown after the trust sections and BEFORE the FAQ (the hub's
   * own "why we build in the open" sections). The FAQ is the last thing on a
   * page, so with this the page draws: trust sections, this content at the
   * page's full width, then the FAQ. Absent: the FAQ closes the sections column.
   */
  beforeFaq?: ReactNode;
  /**
   * The "Data synced from <source>" line and its PDF download in the status row. Default true. Pass false when the
   * host's own header states both (the hub's admin preview draws them in its page header), so the page never says
   * them twice; the monitoring status stays.
   */
  attribution?: boolean;
  /** The FAQ's loading state, group by group (the FAQ's `skeletonShape`). */
  faqSkeletonShape?: FaqSkeletonShape;
  /**
   * Rows each panel's loading state draws, for a host whose lists are curated (it knows their lengths: the frameworks
   * it is audited against). Absent: a typical count, at every width.
   */
  panelSkeletonRows?: Partial<Record<TrustCenterPanelId, TrustPanelRows>>;
}

/** One section's page content. Its `h2` is the `TRUST_CENTER_SECTIONS` label — never a literal here. */
interface TrustSectionView {
  lead?: string;
  render: (data: TrustCenterPublic) => ReactNode;
}

/**
 * The Controls section's first answer, from the page's own server data: the
 * first category's controls with no query — exactly what the controls endpoint
 * answers for it, so the first paint needs no request.
 */
function controlsSeed(data: TrustCenterPublic): TrustCenterControlsPage {
  const first = data.controlDomains[0] ?? null;
  return {
    domain: first?.domain ?? null,
    query: '',
    categories: data.controlDomains.map(domain => ({ domain: domain.domain, count: domain.controls.length })),
    controls: first?.controls ?? [],
    total: data.controlDomains.reduce((sum, domain) => sum + domain.controls.length, 0),
  };
}

/**
 * The projection the page renders while it is read: nothing listed, so every section's component, in the loading
 * scope, draws its own skeleton. Never shown as data (the scope draws no read word).
 */
const EMPTY_TRUST_CENTER: TrustCenterPublic = {
  frameworks: [],
  controlDomains: [],
  policies: [],
  documents: [],
  subprocessors: [],
  aiPractices: [],
  faqs: [],
  checkedAt: null,
  syncedAt: null,
  monitoredWindowMs: 0,
  connected: true,
  dataSource: { name: '', logoUrl: null },
  documentRequestCategory: '',
};

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
  // Before mount the clock is the server's, so the text claims nothing either way.
  if (data.connected && !hydrated) return { status: 'missing', label: 'Checking monitoring status' };
  return trustCenterMonitoringStatus(data, nowMs);
}

export function TrustCenterPage({
  endpoint = TRUST_CENTER_API_PATH,
  initialData,
  shell = true,
  backButton = false,
  title = TRUST_CENTER_TITLE,
  subtitle = TRUST_CENTER_TAGLINE,
  ask,
  beforeFaq,
  attribution = true,
  faqSkeletonShape,
  panelSkeletonRows,
}: TrustCenterPageProps) {
  // In a page's loading state the projection is read (the host passes none): the page draws its skeleton.
  const scoped = useLoadingScope();
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

  const loading = scoped || (!data && isLoading && !error);
  // While loading every section is drawn (which ones the data fills is not known yet), each as its own skeleton.
  const view = loading ? EMPTY_TRUST_CENTER : data;
  const sections = useMemo<Array<(typeof TRUST_CENTER_SECTIONS)[number]>>(
    () => (loading ? [...TRUST_CENTER_SECTIONS] : data ? visibleTrustCenterSections(data) : []),
    [loading, data],
  );
  // Anchors. The scroll spy lights the rail from whatever scrolls the sections
  // (the window, or a host shell's `<main overflow-y-auto>` — OpenFrame's
  // `AppLayout`) and keeps the URL's hash on the section in view (`syncHash`;
  // `replace`: the rail is a table of contents, not a navigation step). A rail
  // click goes through the spy too: it highlights the section at once, writes
  // `#section` and scrolls it below the sticky header — the SAME offset the
  // spy's detection line uses, so the highlight agrees with where the section
  // landed. A visit that ARRIVES with `#section`, and back/forward, scroll
  // there once the sections have rendered (`hashchange`, which `replaceState`
  // never fires — so a click never re-scrolls through that path).
  const { activeSection, handleSectionClick } = useScrollSpy(sections, {
    syncHash: true,
    headerOffset: STICKY_HEADER_OFFSET_PX,
  });
  useScrollToHash(!loading && sections.length > 0 ? sections.map(section => section.id).join('|') : null, {
    headerOffset: STICKY_HEADER_OFFSET_PX,
  });
  const openRequest = useCallback((documentTitle: string | null) => setRequest({ open: true, documentTitle }), []);
  const closeRequest = useCallback(() => setRequest(current => ({ ...current, open: false })), []);

  const hasGatedDocuments = view?.documents.some(document => document.access === 'request') ?? false;
  const actions = hasGatedDocuments
    ? [{ label: 'Request access', variant: 'accent' as const, onClick: () => openRequest(null) }]
    : undefined;
  // The page as a file (the hub's `pdf` route beside `endpoint`). An occasional
  // utility on a read-only page, so it is NOT a header action (a button there,
  // and a fixed bar on a phone, are for the page's task: Request access). It is
  // the shared small `DownloadButton` at the end of the status line under the
  // title, at every width.
  const download = <DownloadButton label="Download PDF" href={trustCenterPdfUrl(endpoint)} />;

  // Section id → its content. Titles come from `TRUST_CENTER_SECTIONS`; which
  // sections show comes from `visibleTrustCenterSections` — this map only says what each renders.
  const views: Record<TrustCenterSectionId, TrustSectionView> = {
    ai: {
      lead: TRUST_SECTION_LEADS.ai,
      render: d => <AiSection practices={d.aiPractices} skeletonRows={panelSkeletonRows?.ai} />,
    },
    compliance: {
      lead: TRUST_SECTION_LEADS.compliance,
      render: d => <ComplianceSection frameworks={d.frameworks} skeletonRows={panelSkeletonRows?.compliance} />,
    },
    controls: {
      lead: TRUST_SECTION_LEADS.controls,
      render: d => <ControlsSection endpoint={endpoint} seed={controlsSeed(d)} />,
    },
    documents: {
      lead: TRUST_SECTION_LEADS.documents,
      render: d => (
        <DocumentsSection
          documents={d.documents}
          documentUrl={document => trustCenterDocumentUrl(endpoint, document)}
          onRequest={openRequest}
          skeletonRows={panelSkeletonRows?.documents}
        />
      ),
    },
    subprocessors: {
      lead: TRUST_SECTION_LEADS.subprocessors,
      render: d => (
        <SubprocessorsSection subprocessors={d.subprocessors} skeletonRows={panelSkeletonRows?.subprocessors} />
      ),
    },
    // The FAQ's skeleton props shape only its loading state (in the scope it draws its own skeleton).
    faq: {
      render: d => <FaqSection initialFaqs={d.faqs} heading={null} ask={ask} skeletonShape={faqSkeletonShape} />,
    },
    contact: { render: () => <ContactSection onContact={() => openRequest(null)} /> },
  };

  // With host content before it, the FAQ leaves the sections column and closes the page (below).
  const faqSection = sections.find(section => section.id === 'faq');
  const faqLast = Boolean(beforeFaq) && Boolean(faqSection);
  const columnSections = faqLast ? sections.filter(section => section.id !== 'faq') : sections;

  // The page's view in its loading state: the same components in a loading scope (no element of its own in the
  // layout: `contents`), announced once unless a host's scope already did.
  const inLoadingScope = (node: ReactNode, label: string): ReactNode =>
    loading ? (
      <LoadingFallback label={label} className="contents">
        {node}
      </LoadingFallback>
    ) : (
      node
    );

  let body: ReactNode;
  if (!loading && error && !data) {
    body = <LoadError message="Could not load the trust center" onRetry={reload} />;
  } else if (!view) {
    body = null;
  } else {
    const status = monitoringStatus(view, hydrated, nowMs);
    body = inLoadingScope(
      <>
        <div className={TRUST_STATUS_ROW_CLASS}>
          <StatusIndicator status={status.status} label={status.label} />
          {view.connected && attribution ? (
            <DataAttribution
              icon={
                view.dataSource.logoUrl ? (
                  <EntityImage
                    src={view.dataSource.logoUrl}
                    alt={view.dataSource.name}
                    fallbackText={view.dataSource.name}
                    sizeClassName="size-4"
                  />
                ) : undefined
              }
              source={view.dataSource.name}
              lastUpdated={view.syncedAt}
              action={download}
            />
          ) : attribution ? (
            download
          ) : null}
        </div>

        <div className={TRUST_BODY_GRID_CLASS}>
          <div className={TRUST_SECTIONS_COLUMN_CLASS}>
            {columnSections.map(section => {
              const sectionView = views[section.id];
              return (
                <TrustSection key={section.id} id={section.id} title={section.label} lead={sectionView.lead}>
                  {sectionView.render(view)}
                </TrustSection>
              );
            })}
          </div>

          <aside className="hidden content-lg:block" aria-label="Trust center sections">
            <div className="sticky" style={{ top: STICKY_HEADER_OFFSET_PX }}>
              <StickySectionNav
                sections={sections.map(section => ({ id: section.id, label: section.label }))}
                activeSection={activeSection}
                onSectionClick={handleSectionClick}
              />
            </div>
          </aside>
        </div>

        {loading ? null : (
          <DocumentRequestModal
            open={request.open}
            documentTitle={request.documentTitle}
            category={view.documentRequestCategory}
            onClose={closeRequest}
          />
        )}
      </>,
      'Loading the trust center',
    );
  }

  return (
    <>
      <TrustCenterChrome shell={shell} title={title} subtitle={subtitle} backButton={backButton} actions={actions}>
        {body}
      </TrustCenterChrome>
      {beforeFaq}
      {faqLast && faqSection && view
        ? // The page's own content box at its FULL width (no section-rail column): a closing FAQ takes the
          // same space the FAQ block takes at the foot of every other page.
          inLoadingScope(
            <div className={shell ? 'bg-ods-bg' : undefined}>
              <div className={shell ? 'page-shell-content mx-auto max-w-[1920px]' : 'page-shell-content'}>
                <TrustSection id={faqSection.id} title={faqSection.label} lead={views.faq.lead}>
                  {views.faq.render(view)}
                </TrustSection>
              </div>
            </div>,
            'Loading the FAQ',
          )
        : null}
    </>
  );
}

/**
 * @deprecated Render `<TrustCenterPage>` inside a `LoadingScope`: the page draws its own loading state (this is what
 * it does). Kept so hosts on an older release keep compiling; nothing in the lib uses it. `region` is ignored: the
 * page announces its own loading state.
 */
export function TrustCenterPageSkeleton({
  region: _region,
  ...chrome
}: Pick<TrustCenterPageProps, 'shell' | 'backButton' | 'title' | 'subtitle'> & {
  /** Ignored: the page announces its own loading state. */
  region?: boolean;
}) {
  return (
    <LoadingScope>
      <TrustCenterPage {...chrome} />
    </LoadingScope>
  );
}

/**
 * The page's chrome, ONE copy for the page and its skeleton: the standalone
 * `PageShell` or the host's padded box (`shell`), and the frozen `PageLayout`
 * header (title, subtitle, back button, actions).
 */
function TrustCenterChrome({
  shell,
  title,
  subtitle,
  backButton,
  actions,
  children,
}: Required<Pick<TrustCenterPageProps, 'shell' | 'title' | 'subtitle' | 'backButton'>> & {
  actions?: Array<{ label: string; variant: 'accent'; onClick: () => void }>;
  children: ReactNode;
}) {
  const router = useRouter();
  const backCfg =
    backButton === false
      ? undefined
      : { label: backButton.label ?? 'Back to home', onClick: () => router.push(backButton.href ?? '/') };
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
      {children}
    </PageLayout>
  );
  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
