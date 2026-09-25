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

import { createElement, useMemo, useState, type ReactNode } from 'react';
import {
  TRUST_DOCUMENT_REQUEST_PREFIX,
  TRUST_FRAMEWORK_STATUSES,
  trustControlQueryMatcher,
  trustDocumentContactReason,
  trustFrameworkStatusEntry,
  type TrustCenterAiPractice,
  type TrustCenterControl,
  type TrustCenterControlDomain,
  type TrustCenterDocument,
  type TrustCenterFramework,
  type TrustCenterSubprocessor,
  type TrustFrameworkStatusEntry,
} from '../../types/trust-center';
import { getFlagFromCountryName } from '../../utils/country-phone-utils';
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
import { CardSkeletonGrid } from '../loading/card-skeleton';
import { TextSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button/button';
import { EntityImage } from '../ui/entity-image';
import { LoadError } from '../ui/error-state';
import { ModalV2, ModalV2Content, ModalV2Header, ModalV2Title } from '../ui/modal-v2';
import { ScrollShadow } from '../ui/scroll-fade';
import { SearchInput } from '../ui/search-input';
import { StackedRowsPanel, type PanelRow } from '../ui/stacked-rows-panel';
import { StatusBadge } from '../ui/status-badge';
import { TabNavigation, type TabItem } from '../ui/tab-navigation';
import { Tag } from '../ui/tag';

/** Status `icon` vocabulary (owned by `TRUST_FRAMEWORK_STATUSES`) → icon component, ONE lookup. */
const FRAMEWORK_ICONS: Record<TrustFrameworkStatusEntry['icon'], typeof ShieldCheckIcon> = {
  'shield-check': ShieldCheckIcon,
  'file-shield': FileShieldIcon,
};

const STACK_CLASSES = 'flex flex-col gap-[var(--spacing-system-l)]';
const BODY_TEXT = 'text-h6 text-ods-text-secondary';
/**
 * The right-hand action / status column: ONE width from tablet up, so every
 * panel's rows line up; on phones it hugs its content so the title keeps the room.
 */
const ACTION_COLUMN = 'shrink-0 md:w-36';

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
export function AiSection({ practices }: { practices: TrustCenterAiPractice[] }) {
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
  return <StackedRowsPanel rows={rows} />;
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

/** A framework's secondary line: its report period and, when published, its passing share (the status is the badge). */
function frameworkDetail(framework: TrustCenterFramework): string | undefined {
  const parts = [
    framework.reportPeriod,
    typeof framework.percent === 'number' ? `${framework.percent}% of controls passing` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Real proof first (certified → in audit → in progress), roadmap items last —
 * one row per framework, status as a badge in a fixed-width column.
 */
export function ComplianceSection({ frameworks }: { frameworks: TrustCenterFramework[] }) {
  const order = TRUST_FRAMEWORK_STATUSES.map(entry => entry.status);
  const sorted = [...frameworks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  const rows: PanelRow[] = sorted.map(framework => {
    const entry = trustFrameworkStatusEntry(framework.status);
    const Icon = FRAMEWORK_ICONS[entry.icon];
    return {
      id: framework.id,
      columns: [
        {
          key: 'framework',
          leadingIcon: <Icon aria-hidden="true" />,
          value: framework.label,
          label: frameworkDetail(framework),
          wrap: true,
        },
        {
          key: 'status',
          width: ACTION_COLUMN,
          align: 'right',
          content: <StatusBadge text={entry.label} colorScheme={entry.color} singleLine />,
        },
      ],
    };
  });
  return <StackedRowsPanel rows={rows} />;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * The query's first match in `text`, emphasised (ODS accent). Presentation
 * only: the SERVER decides which controls match (`?q=`), with the same
 * `trustControlQueryMatcher`, so every returned row shows why. Exported for tests.
 */
export function highlight(text: string, query: string): ReactNode {
  const match = trustControlQueryMatcher(query)?.exec(text) ?? null;
  if (!match) return text;
  const at = match.index;
  const end = at + match[0].length;
  return (
    <>
      {text.slice(0, at)}
      <strong className="text-ods-accent">{text.slice(at, end)}</strong>
      {text.slice(end)}
    </>
  );
}

/** ONE row renderer for every controls list (cards, search results). */
function controlRows(controls: TrustCenterControl[], query = ''): PanelRow[] {
  return controls.map(control => ({
    id: control.id,
    columns: [
      {
        key: 'control',
        leadingIcon: <CheckIcon className="text-ods-success" role="img" aria-label="Passing" />,
        value: highlight(control.name, query),
        // A description-only match is emphasised too: every kept row shows why it matched.
        label: control.description ? highlight(control.description, query) : undefined,
        wrap: true,
      },
    ],
  }));
}

function countLabel(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** The server's answer to the current query (`GET …?q=`), as the page holds it. */
export interface ControlsSearchState {
  /** The matching categories, or null while the answer for the typed query is not in yet. */
  results: TrustCenterControlDomain[] | null;
  error: boolean;
  onRetry: () => void;
}

/** The "every category" tab. */
const ALL_CONTROLS_TAB = 'all';

/** The controls list's FIXED height: browse, search, loading, empty and error all fill the same box, so nothing below it moves. */
const CONTROLS_LIST_HEIGHT = 'h-[28rem] md:h-[36rem]';

/** Skeleton rows shown in the list box while a search answer is on its way. */
const CONTROLS_SKELETON_ROWS = 6;

function controlCount(domains: readonly TrustCenterControlDomain[]): number {
  return domains.reduce((sum, domain) => sum + domain.controls.length, 0);
}

function controlsTabId(domain: string): string {
  return `domain-${domain.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function ControlsListSkeleton() {
  const rows: PanelRow[] = Array.from({ length: CONTROLS_SKELETON_ROWS }, (_, index) => ({
    id: `skeleton-${index}`,
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
  return <StackedRowsPanel rows={rows} />;
}

/**
 * Controls: category TABS (each with its count), the search INSIDE the
 * section, and ONE fixed-height list box. Whatever the list shows — every
 * control, the server's matches, skeleton rows while the answer is on its way,
 * the empty or the error state — fills the same box, so typing never moves the
 * page. While searching, the tab counts are the SERVER's matches per category;
 * a tab only picks which of the returned categories is shown.
 */
export function ControlsSection({
  domains,
  query,
  search,
  onQueryChange,
}: {
  domains: TrustCenterControlDomain[];
  query: string;
  search: ControlsSearchState;
  onQueryChange: (query: string) => void;
}) {
  const [selectedTab, setSelectedTab] = useState(ALL_CONTROLS_TAB);
  const trimmed = query.trim();
  const searching = trimmed.length > 0;
  // What the list is showing: the server's answer while searching (null until it arrives), else everything.
  const shown = searching ? search.results : domains;
  const total = useMemo(() => controlCount(domains), [domains]);

  const tabs: TabItem[] = [
    { id: ALL_CONTROLS_TAB, label: `All · ${shown === null ? total : controlCount(shown)}` },
    ...domains.map(domain => {
      const inShown = shown?.find(candidate => candidate.domain === domain.domain);
      const count = shown === null ? domain.controls.length : (inShown?.controls.length ?? 0);
      return { id: controlsTabId(domain.domain), label: `${domain.domain} · ${count}` };
    }),
  ];
  // A category that left the data (a revalidation) falls back to "All".
  const activeTab = tabs.some(tab => tab.id === selectedTab) ? selectedTab : ALL_CONTROLS_TAB;
  const visible =
    shown === null
      ? null
      : activeTab === ALL_CONTROLS_TAB
        ? shown
        : shown.filter(domain => controlsTabId(domain.domain) === activeTab);

  let summary: string;
  if (!searching) summary = countLabel(total, 'passing control');
  else if (search.error) summary = 'Search is unavailable';
  else if (shown === null) summary = `Searching for “${trimmed}”…`;
  else summary = `${controlCount(shown)} of ${countLabel(total, 'control')} match “${trimmed}”`;

  let body: ReactNode;
  if (searching && search.error) {
    body = <LoadError message="Could not search the controls" onRetry={search.onRetry} />;
  } else if (visible === null) {
    body = <ControlsListSkeleton />;
  } else if (visible.length === 0) {
    body = (
      <ListEmptyState
        isFiltered
        filtered={{
          title: searching ? 'No matching controls' : 'No controls in this category',
          description: searching ? 'Try another word, or another category.' : '',
          clearText: 'Show all controls',
        }}
        onClearFilters={() => {
          onQueryChange('');
          setSelectedTab(ALL_CONTROLS_TAB);
        }}
        empty={{ title: 'No controls', description: '' }}
      />
    );
  } else {
    body = (
      <div className={STACK_CLASSES}>
        {visible.map(domain => (
          <StackedRowsPanel
            key={domain.domain}
            title={`${domain.domain} · ${domain.controls.length}`}
            rows={controlRows(domain.controls, trimmed)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setSelectedTab} />
      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:items-center md:justify-between">
        <p className={BODY_TEXT} aria-live="polite">
          {summary}
        </p>
        <div className="w-full md:w-80">
          <SearchInput
            placeholder="Search controls"
            value={query}
            onChange={onQueryChange}
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
  documentHref,
  onRequest,
}: {
  documents: TrustCenterDocument[];
  /** Where a public document's "View" goes; `null` → offer a request instead. */
  documentHref: (document: TrustCenterDocument) => string | null;
  /** Open the ONE access request, optionally for a named document. */
  onRequest: (documentTitle: string | null) => void;
}) {
  const rows: PanelRow[] = documents.map(document => {
    const gated = document.access === 'request';
    const href = gated ? null : documentHref(document);
    return {
      id: document.title,
      columns: [
        {
          key: 'document',
          leadingIcon: gated ? (
            <LockIcon role="img" aria-label="Available on request" />
          ) : (
            <FileIcon role="img" aria-label="Public" />
          ),
          value: document.title,
          label: gated ? `${document.kind} · available on request` : `${document.kind} · public`,
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
              <Button variant="outline" size="small" href={href} aria-label={`View ${document.title}`}>
                View
              </Button>
            ),
        },
      ],
    };
  });
  return <StackedRowsPanel rows={rows} />;
}

/**
 * The ONE access request (the existing contact flow, `/api/contact`, kept on the
 * page). Only name, email and a pre-filled message: no marketing questions.
 */
export function DocumentRequestModal({
  open,
  documentTitle,
  onClose,
}: {
  open: boolean;
  /** The document the request started from, or null for "all gated documents". */
  documentTitle: string | null;
  onClose: () => void;
}) {
  const reason = documentTitle ? trustDocumentContactReason(documentTitle) : TRUST_DOCUMENT_REQUEST_PREFIX;
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
              title=""
              noBorder
              noPadding
              hideFields={['companySize', 'referralSource', 'helpCategory']}
              defaultValues={{ helpCategory: reason, message }}
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

/** A subprocessor's mark: its brand logo when the icon set has one (`brandLogoForName`), else initials. */
function subprocessorMark(name: string): ReactNode {
  const logo = brandLogoForName(name);
  return logo ? (
    <span role="img" aria-label={name} className="flex">
      {createElement(logo, { className: 'size-6' })}
    </span>
  ) : (
    <EntityImage alt={name} fallbackText={name} sizeClassName="size-6" />
  );
}

/** "🇺🇸 United States": the flag from the shared country lookup beside the name; the name alone when unknown. */
function countryWithFlag(country: string): string {
  const flag = getFlagFromCountryName(country);
  return flag ? `${flag} ${country}` : country;
}

export function SubprocessorsSection({ subprocessors }: { subprocessors: TrustCenterSubprocessor[] }) {
  const rows: PanelRow[] = subprocessors.map(subprocessor => ({
    id: subprocessor.name,
    columns: [
      {
        key: 'name',
        leadingIcon: subprocessorMark(subprocessor.name),
        value: subprocessor.name,
        label: subprocessor.purpose,
        href: subprocessor.url ?? undefined,
      },
      {
        key: 'location',
        value: countryWithFlag(subprocessor.location),
        label: 'Location',
        hideAt: 'md',
        width: 'w-48 shrink-0',
      },
      {
        key: 'category',
        width: 'w-56 shrink-0',
        align: 'right',
        // Phones keep name + purpose readable; the category is a desktop column.
        hideAt: 'md',
        content: <Tag variant="outline" label={subprocessor.category} />,
      },
    ],
  }));
  return <StackedRowsPanel rows={rows} />;
}

// ---------------------------------------------------------------------------
// Contact + loading
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

/** Mirrors the page: a card row, then the controls grid. */
export function TrustCenterSkeleton() {
  return (
    <div className={STACK_CLASSES}>
      <CardSkeletonGrid count={2} variant="category" />
      <CardSkeletonGrid count={4} variant="category" />
    </div>
  );
}
