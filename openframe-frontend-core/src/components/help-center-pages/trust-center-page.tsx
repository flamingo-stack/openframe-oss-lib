'use client';

/**
 * `<TrustCenterPage>` — the full public trust center (Vanta-fed, hub-projected).
 *
 * ONE page, not tabs (2026 trust-center practice: buyers skim and Ctrl-F, and a
 * questionnaire needs a deep link per section): hero with the monitoring status
 * and the two actions, then anchored sections in reading order
 * (`TRUST_CENTER_SECTIONS`: AI & data use → compliance → controls → documents →
 * subprocessors → FAQ → contact) with a sticky section rail on desktop
 * (`StickySectionNav` + `useScrollSpy`, the vendor-page / DocViewer pattern).
 * Built ONLY from existing lib components (see `trust-center-sections.tsx`); the
 * chrome is the canonical `PageShell` + frozen `PageLayout`.
 *
 * DATA: `useSelfFetch` against `endpoint` (default `TRUST_CENTER_API_PATH`;
 * embedders pass their `/content` proxy path). `initialData` (hub SSR) skips the
 * first fetch; a visible tab re-validates after `TRUST_CENTER_CACHE_SECONDS`.
 *
 * MONITORING is derived on the client AFTER MOUNT from `syncedAt` +
 * `monitoredWindowMs` (`isTrustCenterMonitored`). Before mount the status is
 * NEUTRAL (never a claim that flips), and the subtitle only promises continuous
 * monitoring when the projection is connected.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from '../../embed-shims/next-navigation';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import {
  TRUST_CENTER_API_PATH,
  TRUST_CENTER_CACHE_SECONDS,
  TRUST_CENTER_SECTIONS,
  isTrustCenterMonitored,
  type TrustCenterPublic,
  type TrustCenterSectionId,
} from '../../types/trust-center';
import { formatAbsoluteDate, formatRelativeTime } from '../../utils/date-utils';
import { useScrollSpy } from '../docs/use-scroll-spy';
import { PageShell } from '../layout/article-detail-layout';
import { PageLayout } from '../layout/page-layout';
import { StickySectionNav } from '../navigation/sticky-section-nav';
import { LoadError } from '../ui/error-state';
import { SearchInput } from '../ui/search-input';
import { StatusIndicator } from '../ui/status-indicator';
import {
  AiSection,
  ComplianceSection,
  ContactSection,
  ControlsSection,
  DocumentRequestModal,
  DocumentsSection,
  FaqList,
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
  /** Page title. Default "Trust Center". */
  title?: string;
  /** Overrides the data-driven subtitle. */
  subtitle?: string;
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

/** The status line: neutral before mount, then monitored / paused / not enabled. */
function monitoringStatus(
  data: TrustCenterPublic,
  hydrated: boolean,
  nowMs: number,
): { status: 'success' | 'pending' | 'missing'; label: string } {
  if (!data.connected) return { status: 'missing', label: 'Live control monitoring is not enabled yet' };
  if (!hydrated) {
    return {
      status: 'missing',
      label: data.checkedAt ? `Controls last checked ${formatAbsoluteDate(data.checkedAt)}` : 'Controls monitored',
    };
  }
  const checked = data.checkedAt ? ` · updated ${formatRelativeTime(data.checkedAt)}` : '';
  return isTrustCenterMonitored(data, nowMs)
    ? { status: 'success', label: `Controls continuously monitored${checked}` }
    : { status: 'pending', label: `Monitoring paused${checked}` };
}

export function TrustCenterPage({
  endpoint = TRUST_CENTER_API_PATH,
  initialData,
  shell = true,
  backButton = false,
  title = 'Trust Center',
  subtitle,
}: TrustCenterPageProps) {
  const router = useRouter();
  const { data, isLoading, error, reload } = useSelfFetch<TrustCenterPublic>(endpoint, {
    initialData,
    revalidateOnVisibleAfterMs: TRUST_CENTER_CACHE_SECONDS * 1000,
  });
  // `false` during SSR + hydration, `true` after mount — gates everything clock-dependent.
  const hydrated = useIsHydrated();
  // Read the clock once per mount (a lazy initialiser, not a render-time call).
  const [nowMs] = useState(() => Date.now());
  const [request, setRequest] = useState<{ open: boolean; documentTitle: string | null }>({
    open: false,
    documentTitle: null,
  });
  const [controlsQuery, setControlsQuery] = useState('');

  const sections = useMemo(() => (data ? visibleSections(data) : []), [data]);
  const { activeSection, handleSectionClick } = useScrollSpy(sections);
  const openRequest = useCallback((documentTitle: string | null) => setRequest({ open: true, documentTitle }), []);
  const closeRequest = useCallback(() => setRequest(current => ({ ...current, open: false })), []);

  const backCfg =
    backButton === false
      ? undefined
      : { label: backButton.label ?? 'Back to home', onClick: () => router.push(backButton.href ?? '/') };

  const resolvedSubtitle = subtitle ?? 'Security, privacy and AI governance at Flamingo.';
  const hasGatedDocuments = data?.documents.some(document => document.access === 'request') ?? false;
  const actions = data
    ? [
        ...(hasGatedDocuments
          ? [{ label: 'Request access', variant: 'accent' as const, onClick: () => openRequest(null) }]
          : []),
        { label: 'Email security', variant: 'outline' as const, href: `mailto:${data.contact.securityEmail}` },
      ]
    : undefined;

  let body: ReactNode;
  if (error && !data) {
    body = <LoadError message="Could not load the trust center" onRetry={reload} />;
  } else if (!data) {
    body = isLoading ? <TrustCenterSkeleton /> : null;
  } else {
    const status = monitoringStatus(data, hydrated, nowMs);
    const shown = new Set(sections.map(section => section.id));
    body = (
      <>
        <StatusIndicator status={status.status} label={status.label} />

        <div className="grid grid-cols-1 gap-[var(--spacing-system-xl)] lg:grid-cols-[minmax(0,1fr)_12rem]">
          <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxl)]">
            {shown.has('ai') && (
              <TrustSection
                id="ai"
                title="AI & data use"
                lead="How customer data is handled by the AI in our products."
              >
                <AiSection practices={data.aiPractices} />
              </TrustSection>
            )}
            {shown.has('compliance') && (
              <TrustSection
                id="compliance"
                title="Compliance"
                lead="Frameworks we are audited against, and what is next."
              >
                <ComplianceSection frameworks={data.frameworks} />
              </TrustSection>
            )}
            {shown.has('controls') && (
              <TrustSection
                id="controls"
                title="Controls"
                lead="Security controls currently passing in continuous monitoring (via Vanta)."
                aside={
                  <SearchInput
                    placeholder="Search controls"
                    value={controlsQuery}
                    onChange={setControlsQuery}
                    debounceMs={0}
                    showDropdown={false}
                  />
                }
              >
                <ControlsSection domains={data.controlDomains} query={controlsQuery} onQueryChange={setControlsQuery} />
              </TrustSection>
            )}
            {shown.has('documents') && (
              <TrustSection
                id="documents"
                title="Documents"
                lead="Public documents open directly. Gated documents are shared under NDA after one short request."
              >
                <DocumentsSection documents={data.documents} onRequest={openRequest} />
              </TrustSection>
            )}
            {shown.has('subprocessors') && (
              <TrustSection
                id="subprocessors"
                title="Subprocessors"
                lead="Third parties that process customer data on our behalf."
              >
                <SubprocessorsSection subprocessors={data.subprocessors} />
              </TrustSection>
            )}
            {shown.has('faq') && (
              <TrustSection id="faq" title="FAQ">
                <FaqList faqs={data.faqs} />
              </TrustSection>
            )}
            <TrustSection id="contact" title="Contact">
              <ContactSection contact={data.contact} />
            </TrustSection>
          </div>

          <aside className="hidden lg:block" aria-label="Trust center sections">
            <div className="sticky top-24">
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
      subtitle={resolvedSubtitle}
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
