'use client';

/**
 * Section compositions for `<TrustCenterPage>`. Every visual element here is an
 * EXISTING shared lib component — no new primitive, no styled wrapper and no
 * intrinsic interactive/semantic HTML (`__tests__/trust-center-page.test.tsx`
 * statically enforces that). The only own markup is layout `div`/`section`s with
 * ODS spacing tokens, the same as `RoadmapPage` / `DeliveryPage`.
 *
 * The layout follows 2026 trust-center practice (Anthropic, OpenAI, Vanta,
 * Linear, Cursor, ElevenLabs): ONE page with a section rail, AI & data use first,
 * certified proof above roadmap items, every control of every category always
 * shown (no drawers, no "view all", no collapsing), and a controls SEARCH the
 * server answers as one flat, grouped, counted list.
 */

import { createElement, useState, type CSSProperties, type ReactNode } from 'react';
import { useDebounce } from '../../hooks/ui/use-debounce';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import { ICON_SIZE } from '../../styles/component-sizes';
import {
  TRUST_CENTER_SEARCH_DEBOUNCE_MS,
  normalizeTrustControlQuery,
  trustCenterControlsUrl,
  trustFrameworkBadge,
  trustFrameworkMonitoringEntry,
  type TrustCenterAiPractice,
  type TrustCenterControl,
  type TrustCenterControlsPage,
  type TrustCenterDocument,
  type TrustCenterFramework,
  type TrustCenterSectionId,
  type TrustCenterSubprocessor,
  type TrustFrameworkMonitoringEntry,
} from '../../types/trust-center';
import { cn } from '../../utils/cn';
import { getFlagFromCountryName } from '../../utils/country-phone-utils';
import { RESCUE_FORMS } from '../../utils/form-rescue';
import { STICKY_HEADER_OFFSET_PX } from '../../utils/same-page-hash-nav';
import { brandLogoForName } from '../chat/utils/icon-library';
import { ContactForm } from '../contact/contact-form';
import { FileIcon } from '../icons-v2-generated/documents/file-icon';
import { FileShieldIcon } from '../icons-v2-generated/documents/file-shield-icon';
import { BrainAIIcon } from '../icons-v2-generated/health/brain-ai-icon';
import { LockIcon } from '../icons-v2-generated/security/lock-icon';
import { ShieldCheckIcon } from '../icons-v2-generated/security/shield-check-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { SECTION_HEADING_CLASS } from '../layout/page-heading';
import { ListEmptyState } from '../list-empty-state';
import { LoadingRegion } from '../loading/loading-region';
import { InteractiveSkeleton, TextLineSkeleton, TextSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button/button';
import { COMPLIANCE_LOGO_SIZE_CLASS, ComplianceLogo } from '../ui/compliance-badge';
import { EntityImage } from '../ui/entity-image';
import { LoadError } from '../ui/error-state';
import { useLoadingScope } from '../ui/loading-scope';
import { ModalV2, ModalV2Content, ModalV2Header, ModalV2Title } from '../ui/modal-v2';
import { ScrollShadow } from '../ui/scroll-fade';
import { SearchInput } from '../ui/search-input';
import { StackedRowsPanel, type PanelRow } from '../ui/stacked-rows-panel';
import { StatusBadge } from '../ui/status-badge';
import { TabNavigation, type TabItem } from '../ui/tab-navigation';

/** Monitoring `icon` vocabulary (owned by `TRUST_FRAMEWORK_MONITORING`) → icon component, ONE lookup. */
const FRAMEWORK_ICONS: Record<TrustFrameworkMonitoringEntry['icon'], typeof ShieldCheckIcon> = {
  'shield-check': ShieldCheckIcon,
  'file-shield': FileShieldIcon,
};

const BODY_TEXT = 'text-h6 text-ods-text-secondary';

/**
 * The page body's layout, ONE copy for the loaded page and its skeleton, so the
 * skeleton cannot drift from what replaces it: the status row, then the sections
 * beside the section rail.
 */
export const TRUST_STATUS_ROW_CLASS =
  'flex flex-col gap-[var(--spacing-system-xsf)] content-md:flex-row content-md:items-center content-md:justify-between';
export const TRUST_BODY_GRID_CLASS =
  'grid grid-cols-1 gap-[var(--spacing-system-xl)] content-lg:grid-cols-[minmax(0,1fr)_12rem]';
export const TRUST_SECTIONS_COLUMN_CLASS = 'flex min-w-0 flex-col gap-[var(--spacing-system-xxl)]';

/** Each section's one-line lead under its heading (the page and its skeleton read the same copy). */
export const TRUST_SECTION_LEADS: Partial<Record<TrustCenterSectionId, string>> = {
  compliance: 'Frameworks we are audited against, and what is next.',
  controls: 'Security controls currently passing in continuous monitoring (via Vanta).',
  documents: 'Public documents open directly. Gated documents are shared under NDA after one short request.',
  subprocessors: 'Third parties that process customer data on our behalf.',
  ai: 'How customer data is handled by the AI in our products.',
};
/**
 * The right-hand action / status column: ONE width from tablet up, so every
 * panel's rows line up; on phones it hugs its content so the title keeps the room.
 */
const ACTION_COLUMN = 'shrink-0 content-md:w-36';

// ---------------------------------------------------------------------------
// Section frame
// ---------------------------------------------------------------------------

/** One anchored page section: an `h2` + optional lead line + content. */
export function TrustSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="flex flex-col gap-[var(--spacing-system-m)]"
      style={{ scrollMarginTop: STICKY_HEADER_OFFSET_PX }}
    >
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        <h2 id={headingId} className={SECTION_HEADING_CLASS}>
          {title}
        </h2>
        {lead ? <p className={BODY_TEXT}>{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AI & data use
// ---------------------------------------------------------------------------

/**
 * The AI statements — the company's Vanta Trust Center FAQs in its AI category,
 * in Vanta's order: the question as the row title, the answer beneath. The
 * first is the commitment (success shield). The page's ONE row style.
 */
export function AiSection({
  practices,
  skeletonRows,
}: {
  practices: TrustCenterAiPractice[];
  /** Rows the loading state draws (`TrustPanelRows`). Absent: a typical count. */
  skeletonRows?: TrustPanelRows;
}) {
  if (useLoadingScope()) return <TrustPanelSkeleton panel="ai" rows={skeletonRows} />;
  const rows: PanelRow[] = practices.map(practice => ({
    id: practice.label,
    columns: [
      {
        key: 'practice',
        leadingIcon: practice.commitment ? (
          <ShieldCheckIcon className="text-ods-success" role="img" aria-label="Commitment" />
        ) : (
          <BrainAIIcon aria-hidden="true" />
        ),
        value: practice.label,
        label: practice.value,
        wrap: true,
      },
    ],
  }));
  return <StackedRowsPanel rows={rows} listItems />;
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

/**
 * One row per framework, in the Vanta Trust Center's order: its name, its
 * Vanta description, and ONE badge: Vanta's completion ("16% complete") or
 * "Planned" — never a certification claim, which Vanta's API does
 * not hold.
 */
export function ComplianceSection({
  frameworks,
  skeletonRows,
}: {
  frameworks: TrustCenterFramework[];
  /** Rows the loading state draws (`TrustPanelRows`): a host whose frameworks are a curated list passes its length. */
  skeletonRows?: TrustPanelRows;
}) {
  if (useLoadingScope()) return <TrustPanelSkeleton panel="compliance" rows={skeletonRows} />;
  const rows: PanelRow[] = frameworks.map(framework => {
    const entry = trustFrameworkMonitoringEntry(framework.monitoring);
    const Icon = FRAMEWORK_ICONS[entry.icon];
    return {
      id: framework.id,
      columns: [
        {
          key: 'framework',
          leadingIcon: (
            <ComplianceLogo names={[framework.standard, framework.label]} fallback={<Icon aria-hidden="true" />} />
          ),
          value: framework.label,
          label: framework.description ?? undefined,
          wrap: true,
        },
        {
          key: 'monitoring',
          width: ACTION_COLUMN,
          align: 'right',
          content: <StatusBadge text={trustFrameworkBadge(framework)} colorScheme={entry.color} singleLine />,
        },
      ],
    };
  });
  return <StackedRowsPanel rows={rows} listItems />;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * Every control row is ONE fixed height (one line of name, one of description),
 * so the list box shows exactly 5 of them and scrolls for
 * the rest.
 */
const CONTROL_ROW_CLASS = 'h-[var(--control-row-h)] overflow-hidden';

/** ONE row renderer for the controls list: fixed-height rows, one line each for name and description. */
function controlRows(controls: TrustCenterControl[]): PanelRow[] {
  return controls.map(control => ({
    id: control.id,
    className: CONTROL_ROW_CLASS,
    columns: [
      {
        key: 'control',
        leadingIcon: <CheckIcon className="text-ods-success" role="img" aria-label="Passing" />,
        value: control.name,
        label: control.description ?? undefined,
      },
    ],
  }));
}

function countLabel(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * The list box: exactly `CONTROLS_SKELETON_ROWS` control rows (`CONTROL_ROW_CLASS`) plus their 1px separators and the
 * panel's 1px border, computed from the section's row height and row count (`CONTROLS_SECTION_CLASS` and
 * `controlsSectionStyle`). Controls, loading, empty and error all fill this same box, so nothing below it moves.
 */
const CONTROLS_LIST_HEIGHT = 'h-[calc(var(--controls-rows)*(var(--control-row-h)+1px)+2px)]';

/**
 * The controls section's stack, loaded and loading. It states a control row's height (3.5rem, 5rem from md: one line
 * of name, one of description), which the rows and the list box read.
 */
const CONTROLS_SECTION_CLASS =
  'flex flex-col gap-[var(--spacing-system-m)] [--control-row-h:3.5rem] content-md:[--control-row-h:5rem]';
/** The controls toolbar (summary line + search), loaded and loading. */
const CONTROLS_TOOLBAR_CLASS =
  'flex flex-col gap-[var(--spacing-system-s)] content-md:flex-row content-md:items-center content-md:justify-between';
const CONTROLS_SEARCH_CLASS = 'w-full content-md:w-80';
const CONTROLS_SEARCH_PLACEHOLDER = 'Search controls';
/** Category tabs the Controls skeleton draws (the categories are read). */
const CONTROLS_SKELETON_TABS = 4;

/** Skeleton rows shown in the list box while the server's answer is on its way: exactly the box's visible rows. */
const CONTROLS_SKELETON_ROWS = 5;
/** The section's row count, which the list box's height reads. */
const controlsSectionStyle = { '--controls-rows': CONTROLS_SKELETON_ROWS } as CSSProperties;

function controlsTabId(domain: string): string {
  return `domain-${domain.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/**
 * The list box while a category or a search is read. It announces itself (`LoadingRegion`) so a tab switch or a search
 * is heard as loading; `region={false}` inside the page's own loading region, which already announced.
 */
function ControlsListSkeleton({ region = true }: { region?: boolean } = {}) {
  const rows: PanelRow[] = Array.from({ length: CONTROLS_SKELETON_ROWS }, (_, index) => ({
    id: `skeleton-${index}`,
    className: CONTROL_ROW_CLASS,
    columns: [
      {
        key: 'control',
        content: (
          <div className="flex w-full flex-col gap-[var(--spacing-system-xs)]">
            <TextSkeleton.Body className="w-2/3" />
            <TextSkeleton.Caption className="w-full" />
          </div>
        ),
      },
    ],
  }));
  return (
    <LoadingRegion label="Loading the controls" announce={region}>
      <StackedRowsPanel rows={rows} />
    </LoadingRegion>
  );
}

/**
 * Controls — 100% SERVER-driven. Every tab switch and every (debounced) search
 * is ONE request to the controls endpoint (`trustCenterControlsUrl`), which
 * answers the categories with their counts, the category shown and its
 * controls; the section only renders that answer. One tab per category (no
 * "All"), the search and the summary line ABOVE a fixed-height list box that
 * scrolls on its own — loading (skeleton rows), empty and error states fill the
 * same box, so the page never jumps.
 *
 * `seed` is the server-rendered answer for the first category with no query
 * (the page's own data), so the first paint needs no request.
 */
export function ControlsSection({ endpoint, seed }: { endpoint: string; seed: TrustCenterControlsPage }) {
  // In a page's loading state the categories and controls are read: the section is its skeleton and reads nothing.
  if (useLoadingScope()) return <ControlsSectionSkeleton />;
  return <ControlsSectionLoaded endpoint={endpoint} seed={seed} />;
}

function ControlsSectionLoaded({ endpoint, seed }: { endpoint: string; seed: TrustCenterControlsPage }) {
  const [domain, setDomain] = useState<string | null>(seed.domain);
  const [typed, setTyped] = useState('');
  const query = useDebounce(normalizeTrustControlQuery(typed), TRUST_CENTER_SEARCH_DEBOUNCE_MS);
  const url = trustCenterControlsUrl(endpoint, { domain, query });
  const seedUrl = trustCenterControlsUrl(endpoint, { domain: seed.domain, query: '' });
  const answer = useSelfFetch<TrustCenterControlsPage>(url, url === seedUrl ? { initialData: seed } : undefined);

  // The answer counts only when it answers what is on screen NOW (the typed
  // query, the selected tab); otherwise the box shows its loading state.
  const typedQuery = normalizeTrustControlQuery(typed);
  const current =
    answer.data && !answer.isLoading && typedQuery === query && answer.data.query === query ? answer.data : null;
  // Tabs keep the last categories the server sent while a new answer loads.
  const [categories, setCategories] = useState(seed.categories);
  if (current && current.categories !== categories) setCategories(current.categories);
  const total = current?.total ?? seed.total;

  const tabs: TabItem[] = categories.map(category => ({
    id: controlsTabId(category.domain),
    label: `${category.domain} · ${category.count}`,
  }));
  const activeDomain = current?.domain ?? domain;
  const activeTab = activeDomain ? controlsTabId(activeDomain) : '';

  let summary: ReactNode;
  if (answer.error && !current) summary = 'Controls are unavailable';
  else if (!current && typedQuery) summary = `Searching for “${typedQuery}”…`;
  // A category's first read: the summary's line as the skeleton's own bar (`ControlsSectionSkeleton`).
  else if (!current) summary = <ControlsSummarySkeleton />;
  else if (query)
    summary = `${current.controls.length} in ${current.domain} match “${query}” · ${countLabel(total, 'control')} in total`;
  else summary = `${countLabel(current.controls.length, 'passing control')} in ${current.domain}`;

  let body: ReactNode;
  if (answer.error && !current) {
    body = <LoadError message="Could not load the controls" onRetry={answer.reload} />;
  } else if (!current) {
    body = <ControlsListSkeleton />;
  } else if (current.controls.length === 0) {
    body = (
      <ListEmptyState
        isFiltered
        filtered={{
          title: 'No matching controls',
          description: 'Try another word, or another category.',
          clearText: 'Clear search',
        }}
        onClearFilters={() => setTyped('')}
        empty={{ title: 'No controls', description: '' }}
      />
    );
  } else {
    body = <StackedRowsPanel rows={controlRows(current.controls)} />;
  }

  return (
    <div className={CONTROLS_SECTION_CLASS} style={controlsSectionStyle}>
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={tabId =>
          setDomain(categories.find(category => controlsTabId(category.domain) === tabId)?.domain ?? null)
        }
      />
      <div className={CONTROLS_TOOLBAR_CLASS}>
        <p className={BODY_TEXT} aria-live="polite">
          {summary}
        </p>
        <div className={CONTROLS_SEARCH_CLASS}>
          <SearchInput
            placeholder={CONTROLS_SEARCH_PLACEHOLDER}
            value={typed}
            onChange={setTyped}
            debounceMs={0}
            showDropdown={false}
          />
        </div>
      </div>
      <ScrollShadow className={CONTROLS_LIST_HEIGHT} scrollClassName="h-full" data-testid="controls-list">
        {body}
      </ScrollShadow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function DocumentsSection({
  documents,
  documentUrl,
  onRequest,
  skeletonRows,
}: {
  documents: TrustCenterDocument[];
  /** Rows the loading state draws (`TrustPanelRows`). Absent: a typical count. */
  skeletonRows?: TrustPanelRows;
  /** Where a public document opens (`trustCenterDocumentUrl`); `null` → offer a request instead. */
  documentUrl: (document: TrustCenterDocument) => string | null;
  /** Open the ONE access request, optionally for a named document. */
  onRequest: (documentTitle: string | null) => void;
}) {
  if (useLoadingScope()) return <TrustPanelSkeleton panel="documents" rows={skeletonRows} />;
  const rows: PanelRow[] = documents.map(document => {
    const gated = document.access === 'request';
    const href = gated ? null : documentUrl(document);
    return {
      id: document.id,
      columns: [
        {
          key: 'document',
          leadingIcon: gated ? (
            <LockIcon role="img" aria-label="Available on request" />
          ) : (
            <FileIcon role="img" aria-label="Public" />
          ),
          value: document.title,
          label: document.description ?? (gated ? 'Available on request' : 'Public'),
          wrap: true,
        },
        {
          key: 'action',
          width: ACTION_COLUMN,
          align: 'right',
          content:
            href === null ? (
              <Button
                variant="outline"
                size="small"
                onClick={() => onRequest(document.title)}
                aria-label={`Request ${document.title}`}
              >
                Request
              </Button>
            ) : (
              <Button variant="outline" size="small" href={href} openInNewTab aria-label={`View ${document.title}`}>
                View
              </Button>
            ),
        },
      ],
    };
  });
  return <StackedRowsPanel rows={rows} listItems />;
}

/**
 * The ONE access request (the existing contact flow, `/api/contact`, kept on the
 * page). Only name, email and a pre-filled message: no marketing questions.
 */
export function DocumentRequestModal({
  open,
  documentTitle,
  category,
  onClose,
}: {
  open: boolean;
  /** The serving platform's help category for these requests (`TrustCenterPublic.documentRequestCategory`). */
  category: string;
  /** The document the request started from, or null for "all gated documents". */
  documentTitle: string | null;
  onClose: () => void;
}) {
  const message = documentTitle
    ? `I'd like access to: ${documentTitle}.`
    : "I'd like access to your gated security documentation.";
  return (
    <ModalV2 isOpen={open} onClose={onClose} size="medium">
      <ModalV2Header>
        <ModalV2Title>Request access</ModalV2Title>
      </ModalV2Header>
      <ModalV2Content>
        {open ? (
          <div className="flex flex-col gap-[var(--spacing-system-m)]">
            <p className={BODY_TEXT}>
              We share gated security documents under NDA. Leave your work email and our security team will follow up
              with access, usually within one business day.
            </p>
            <ContactForm
              rescue={RESCUE_FORMS.trustCenterRequest}
              title=""
              noBorder
              noPadding
              hideFields={['companySize', 'referralSource', 'helpCategory']}
              defaultValues={{ helpCategory: category, message }}
              submitLabel="Request access"
              successRedirectUrl=""
              successToastMessage="Thanks — our security team will follow up by email."
              onSubmitSuccess={onClose}
            />
          </div>
        ) : null}
      </ModalV2Content>
    </ModalV2>
  );
}

// ---------------------------------------------------------------------------
// Subprocessors
// ---------------------------------------------------------------------------

/** A row's glyph mark (a subprocessor's icon, a document's glyph): read by the rows and their skeleton. */
const TRUST_GLYPH_SIZE_CLASS = ICON_SIZE.lg;

/**
 * A subprocessor's mark, best source first: its own site's icon (the hub looks
 * it up from the website Vanta holds), else the brand logo our icon set has for
 * its name (`brandLogoForName`), else initials — which are also what a site
 * icon that fails to load falls back to.
 */
function subprocessorMark({ name, logoUrl }: TrustCenterSubprocessor): ReactNode {
  if (logoUrl)
    return <EntityImage src={logoUrl} alt={name} fallbackText={name} sizeClassName={TRUST_GLYPH_SIZE_CLASS} />;
  const logo = brandLogoForName(name);
  return logo ? (
    <span role="img" aria-label={name} className="flex">
      {createElement(logo, { className: TRUST_GLYPH_SIZE_CLASS })}
    </span>
  ) : (
    <EntityImage alt={name} fallbackText={name} sizeClassName={TRUST_GLYPH_SIZE_CLASS} />
  );
}

/** "🇺🇸 United States": the flag from the shared country lookup beside the name; the name alone when unknown. */
function countryWithFlag(country: string): string {
  const flag = getFlagFromCountryName(country);
  return flag ? `${flag} ${country}` : country;
}

export function SubprocessorsSection({
  subprocessors,
  skeletonRows,
}: {
  subprocessors: TrustCenterSubprocessor[];
  /** Rows the loading state draws (`TrustPanelRows`). Absent: a typical count. */
  skeletonRows?: TrustPanelRows;
}) {
  if (useLoadingScope()) return <TrustPanelSkeleton panel="subprocessors" rows={skeletonRows} />;
  // The location column exists only when Vanta holds a location for at least one of them.
  const anyLocation = subprocessors.some(subprocessor => subprocessor.location);
  const rows: PanelRow[] = subprocessors.map(subprocessor => ({
    id: subprocessor.name,
    columns: [
      {
        key: 'name',
        leadingIcon: subprocessorMark(subprocessor),
        value: subprocessor.name,
        label: subprocessor.purpose ?? subprocessor.description ?? undefined,
        href: subprocessor.url ?? undefined,
        wrap: true,
      },
      ...(anyLocation
        ? [
            {
              key: 'location',
              value: subprocessor.location ? countryWithFlag(subprocessor.location) : '—',
              label: 'Location',
              hideAt: 'md' as const,
              width: 'w-48 shrink-0',
            },
          ]
        : []),
    ],
  }));
  return <StackedRowsPanel rows={rows} listItems />;
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/**
 * Security & compliance questions, routed through the page's ONE request flow
 * (`/api/contact`) — no address is published and no disclosure programme is
 * advertised (industry practice for trust portals: questions go through the
 * account relationship, not an open inbox).
 */
export function ContactSection({ onContact }: { onContact: () => void }) {
  return (
    <StackedRowsPanel
      rows={[
        {
          id: 'questions',
          columns: [
            {
              key: 'questions',
              leadingIcon: <FileShieldIcon aria-hidden="true" />,
              value: 'Security questions',
              label:
                'Customers and prospective customers can reach our security team for questionnaires, documentation or a review call.',
              wrap: true,
            },
            {
              key: 'action',
              width: ACTION_COLUMN,
              align: 'right',
              content: (
                <Button variant="outline" size="small" onClick={onContact}>
                  Get in touch
                </Button>
              ),
            },
          ],
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Rows a panel's skeleton draws when its host states no count. A panel lists every record the host's data holds (no
 * page, no limit), so this is a typical count, drawn at every width; a host whose list is curated passes its length
 * (each section's `skeletonRows`, the page's `panelSkeletonRows`).
 */
const TRUST_PANEL_SKELETON_ROWS = 5;

/** The panels whose rows `TrustPanelSkeleton` draws (Controls, Contact and the FAQ draw their own). */
export type TrustCenterPanelId = 'compliance' | 'documents' | 'subprocessors' | 'ai';

/**
 * Rows a panel's skeleton draws: one count, at every width. The `{ phone, wide }` form is kept for hosts that pass
 * it and draws the larger of the two everywhere (a skeleton never hides rows per breakpoint).
 */
export type TrustPanelRows = number | { phone: number; wide: number };

/**
 * Each panel's row: its mark (a 40px compliance logo or a 24px glyph), its right-hand cell, and the lines its TYPICAL
 * description takes (`text-h6` lines) on a phone (below `content-md`) and from `content-md`. A framework's or an AI
 * statement's text is a few sentences that wrap in a phone's narrow cell; a document's and a subprocessor's is a short
 * phrase on one line. A description longer than typical is the record's length, a settle below its row.
 */
const TRUST_PANEL_SHAPES: Record<
  TrustCenterPanelId,
  { mark: 'logo' | 'glyph'; action: 'badge' | 'button' | 'none'; lines: { phone: number; wide: number } }
> = {
  compliance: { mark: 'logo', action: 'badge', lines: { phone: 4, wide: 1 } },
  documents: { mark: 'glyph', action: 'button', lines: { phone: 1, wide: 1 } },
  subprocessors: { mark: 'glyph', action: 'none', lines: { phone: 1, wide: 1 } },
  ai: { mark: 'glyph', action: 'none', lines: { phone: 6, wide: 2 } },
};

/**
 * A panel section while it is read: rows of the REAL `StackedRowsPanel` (its own row heights and borders, each row a
 * read list item) whose cells hold bars: the panel's mark, a value over its typical description, and the right-hand
 * badge or button in the page's `ACTION_COLUMN`.
 */
function TrustPanelSkeleton({
  panel,
  rows = TRUST_PANEL_SKELETON_ROWS,
}: {
  panel: TrustCenterPanelId;
  rows?: TrustPanelRows;
}) {
  const shape = TRUST_PANEL_SHAPES[panel];
  // The rows the host reads, or a typical panel; a count per width draws the larger, so neither width is short.
  const length = typeof rows === 'number' ? rows : Math.max(rows.phone, rows.wide);
  const panelRows: PanelRow[] = Array.from({ length }, (_, index) => ({
    id: `skeleton-${index}`,
    columns: [
      {
        // The loaded rows' own cell (leading mark, `text-h4` value over a wrapping `text-h6` label): the panel lays
        // the bars out exactly as it lays out the text.
        key: 'item',
        leadingIcon: (
          <UnifiedSkeleton
            className={
              shape.mark === 'logo'
                ? cn(COMPLIANCE_LOGO_SIZE_CLASS, 'shrink-0 rounded-full')
                : cn(TRUST_GLYPH_SIZE_CLASS, 'shrink-0 rounded')
            }
          />
        ),
        value: <TextLineSkeleton type="inherit" as="span" className="w-1/3" />,
        label: (
          <>
            <TextLineSkeleton type="inherit" as="span" lines={shape.lines.phone} className="w-full content-md:hidden" />
            <TextLineSkeleton
              type="inherit"
              as="span"
              lines={shape.lines.wide}
              className="hidden w-full content-md:block"
            />
          </>
        ),
        wrap: true,
      },
      ...(shape.action === 'none'
        ? []
        : [
            {
              key: 'action',
              width: ACTION_COLUMN,
              align: 'right' as const,
              content:
                shape.action === 'badge' ? (
                  <StatusBadge loading text="" />
                ) : (
                  // The rows' action is a `size="small"` Button: its own size classes.
                  <InteractiveSkeleton.Button size="small" className="w-16" />
                ),
            },
          ]),
    ],
  }));
  return <StackedRowsPanel rows={panelRows} listItems />;
}

/** The controls summary line while its counts are read. */
function ControlsSummarySkeleton() {
  return <TextLineSkeleton as="span" type="h6" className="w-48" />;
}

/** The Controls section while loading: its tab strip, its summary and the real search, and the list box's skeleton. */
function ControlsSectionSkeleton() {
  return (
    <div className={CONTROLS_SECTION_CLASS} style={controlsSectionStyle}>
      <TabNavigation loading tabs={[]} skeletonCount={CONTROLS_SKELETON_TABS} />
      <div className={CONTROLS_TOOLBAR_CLASS}>
        <p className={BODY_TEXT}>
          <ControlsSummarySkeleton />
        </p>
        <div className={CONTROLS_SEARCH_CLASS}>
          <SearchInput
            placeholder={CONTROLS_SEARCH_PLACEHOLDER}
            value=""
            onChange={() => undefined}
            debounceMs={0}
            showDropdown={false}
          />
        </div>
      </div>
      <div className={CONTROLS_LIST_HEIGHT}>
        <ControlsListSkeleton region={false} />
      </div>
    </div>
  );
}
