'use client';

/**
 * `<TrustCenterPage>` — the full public trust center (Vanta-fed, hub-projected):
 * monitoring status, framework cards, and tabs for overview / controls /
 * documents / subprocessors / AI / FAQ. Built ONLY from existing lib
 * components (see `trust-center-sections.tsx`); the chrome is the canonical
 * `PageShell` + frozen `PageLayout`, passed through exactly as `RoadmapPage` /
 * `FaqDocumentPage` do.
 *
 * DATA: `useSelfFetch` against `endpoint` (default `TRUST_CENTER_API_PATH`;
 * embedders pass their `/content` proxy path). `initialData` (hub SSR) skips the
 * first fetch; a visible tab re-validates after `TRUST_CENTER_CACHE_SECONDS`.
 *
 * "MONITORED" is derived on the client AFTER MOUNT from `syncedAt` +
 * `monitoredWindowMs` (`isTrustCenterMonitored`) — never in SSR output, so a
 * CDN-cached copy can't keep claiming monitoring after the sync broke, and the
 * relative "last checked" time never mismatches on hydration.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from '../../embed-shims/next-navigation';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import {
  TRUST_CENTER_API_PATH,
  TRUST_CENTER_CACHE_SECONDS,
  TRUST_CENTER_TABS,
  isTrustCenterMonitored,
  type TrustCenterPublic,
  type TrustCenterTabId,
} from '../../types/trust-center';
import { formatAbsoluteDate, formatRelativeTime } from '../../utils/date-utils';
import { PageShell } from '../layout/article-detail-layout';
import { PageLayout } from '../layout/page-layout';
import { Button } from '../ui/button/button';
import { LoadError } from '../ui/error-state';
import { StatusIndicator } from '../ui/status-indicator';
import { TabNavigation, type TabItem } from '../ui/tab-navigation';
import {
  AiSection,
  ContactFooter,
  ControlsSection,
  DocumentRequestModal,
  DocumentsSection,
  FaqTab,
  FrameworkCards,
  OverviewSection,
  SubprocessorsSection,
  TrustCenterSkeleton,
} from './trust-center-sections';

export interface TrustCenterPageProps {
  /** GET endpoint for the public projection. Default `TRUST_CENTER_API_PATH`. */
  endpoint?: string;
  /** Optional SSR hydrate (hub server-read) — skips the initial client fetch. */
  initialData?: TrustCenterPublic;
  /** Render the standalone `<PageShell>`. Default true. Pass false when the host
   *  layout already provides the page container (e.g. openframe-frontend). */
  shell?: boolean;
  /** Back-button config. Pass `false` to hide. Default `{ label: 'Back to home', href: '/' }`. */
  backButton?: { label?: string; href?: string } | false;
  /** Page title. Default "Trust Center". */
  title?: string;
  subtitle?: string;
}

const DEFAULT_SUBTITLE = 'Security, privacy and AI governance — continuously monitored.';
const DOCUMENTS_TAB: TrustCenterTabId = 'documents';

/** Tabs whose section has content — empty sections are hidden, tab included. */
function visibleTabs(data: TrustCenterPublic): TabItem[] {
  const hasContent: Record<TrustCenterTabId, boolean> = {
    overview: true,
    controls: data.controlDomains.length > 0,
    documents: data.documents.length > 0,
    subprocessors: data.subprocessors.length > 0,
    ai: data.aiPractices.length > 0,
    faq: data.faqs.length > 0,
  };
  return TRUST_CENTER_TABS.filter(tab => hasContent[tab.id]).map(tab => ({ id: tab.id, label: tab.label }));
}

export function TrustCenterPage({
  endpoint = TRUST_CENTER_API_PATH,
  initialData,
  shell = true,
  backButton,
  title = 'Trust Center',
  subtitle = DEFAULT_SUBTITLE,
}: TrustCenterPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isLoading, error, reload } = useSelfFetch<TrustCenterPublic>(endpoint, {
    initialData,
    revalidateOnVisibleAfterMs: TRUST_CENTER_CACHE_SECONDS * 1000,
  });
  // `false` during SSR + hydration, `true` after mount — gates everything
  // clock-dependent (monitored flag, relative time).
  const hydrated = useIsHydrated();
  // Read the clock once per mount (a lazy initialiser, not a render-time call).
  const [nowMs] = useState(() => Date.now());
  const [requestedDocument, setRequestedDocument] = useState<string | null>(null);

  const tabs = useMemo(() => (data ? visibleTabs(data) : []), [data]);
  const closeRequest = useCallback(() => setRequestedDocument(null), []);

  const backCfg =
    backButton === false
      ? undefined
      : {
          label: backButton?.label ?? 'Back to home',
          onClick: () => router.push(backButton?.href ?? '/'),
        };

  const openDocumentsTab = () => {
    const params = new URLSearchParams(searchParams?.toString());
    params.set('tab', DOCUMENTS_TAB);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  let body: ReactNode;
  if (error && !data) {
    body = <LoadError message="Could not load the trust center" onRetry={reload} />;
  } else if (!data) {
    body = isLoading ? <TrustCenterSkeleton /> : null;
  } else {
    const monitored = hydrated && isTrustCenterMonitored(data, nowMs);
    const checkedLabel = data.checkedAt
      ? hydrated
        ? formatRelativeTime(data.checkedAt)
        : formatAbsoluteDate(data.checkedAt)
      : null;
    const statusLabel = !hydrated
      ? checkedLabel
        ? `Last checked ${checkedLabel}`
        : 'Checking monitoring status'
      : monitored
        ? `Continuously monitored${checkedLabel ? ` · last checked ${checkedLabel}` : ''}`
        : 'Monitoring paused';
    const hasDocuments = data.documents.length > 0;

    body = (
      <>
        <div className="flex flex-col gap-[var(--spacing-system-m)] md:flex-row md:items-center md:justify-between">
          <StatusIndicator status={monitored ? 'success' : 'pending'} label={statusLabel} />
          {hasDocuments && (
            <Button variant="accent" onClick={openDocumentsTab}>
              Request documents
            </Button>
          )}
        </div>

        <FrameworkCards frameworks={data.frameworks} />

        <TabNavigation tabs={tabs} urlSync defaultTab="overview">
          {activeTab => (
            <div className="flex flex-col gap-[var(--spacing-system-l)] pt-[var(--spacing-system-l)]">
              {activeTab === 'overview' && (
                <OverviewSection
                  frameworkCount={data.frameworks.length}
                  domainCount={data.controlDomains.length}
                  lastCheckedLabel={checkedLabel ?? 'Not yet checked'}
                  policies={data.policies}
                />
              )}
              {activeTab === 'controls' && <ControlsSection domains={data.controlDomains} />}
              {activeTab === 'documents' && (
                <DocumentsSection documents={data.documents} onRequestDocument={setRequestedDocument} />
              )}
              {activeTab === 'subprocessors' && <SubprocessorsSection subprocessors={data.subprocessors} />}
              {activeTab === 'ai' && <AiSection practices={data.aiPractices} />}
              {activeTab === 'faq' && <FaqTab faqs={data.faqs} />}
            </div>
          )}
        </TabNavigation>

        <ContactFooter contact={data.contact} />
        <DocumentRequestModal documentTitle={requestedDocument} onClose={closeRequest} />
      </>
    );
  }

  const inner = (
    <PageLayout title={title} subtitle={subtitle} backButton={backCfg} titleSize="h1" titleWrap>
      {body}
    </PageLayout>
  );

  return shell ? <PageShell>{inner}</PageShell> : <div className="page-shell-content">{inner}</div>;
}
