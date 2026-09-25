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

import { createElement, useState, type ReactNode } from 'react';
import { useDebounce } from '../../hooks/ui/use-debounce';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import {
  TRUST_CENTER_SEARCH_DEBOUNCE_MS,
  TRUST_DOCUMENT_REQUEST_PREFIX,
  normalizeTrustControlQuery,
  trustCenterControlsUrl,
  trustControlQueryMatcher,
  trustDocumentContactReason,
  trustFrameworkBadge,
  trustFrameworkMonitoringEntry,
  type TrustCenterAiPractice,
  type TrustCenterControl,
  type TrustCenterControlsPage,
  type TrustCenterDocument,
  type TrustCenterFramework,
  type TrustCenterSubprocessor,
  type TrustFrameworkMonitoringEntry,
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
import { ComplianceLogo } from '../ui/compliance-badge';
import { EntityImage } from '../ui/entity-image';
import { LoadError } from '../ui/error-state';
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

/**
 * One row per framework, in the Vanta Trust Center's order: its name, its
 * Vanta description, and ONE badge: Vanta's completion ("16% complete") or
 * "Planned" — never a certification claim, which Vanta's API does
 * not hold.
 */
export function ComplianceSection({ frameworks }: { frameworks: TrustCenterFramework[] }) {
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

/**
 * Every control row is ONE fixed height (one line of name, one of description),
 * so the list box shows exactly 5 of them and scrolls for
 * the rest.
 */
const CONTROL_ROW_CLASS = 'h-14 md:h-20 overflow-hidden';

/** ONE row renderer for the controls list: fixed-height rows, one line each for name and description. */
function controlRows(controls: TrustCenterControl[], query = ''): PanelRow[] {
  return controls.map(control => ({
    id: control.id,
    className: CONTROL_ROW_CLASS,
    columns: [
      {
        key: 'control',
        leadingIcon: <CheckIcon className="text-ods-success" role="img" aria-label="Passing" />,
        value: highlight(control.name, query),
        // A description-only match is emphasised too: every kept row shows why it matched.
        label: control.description ? highlight(control.description, query) : undefined,
      },
    ],
  }));
}

function countLabel(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * The list box: exactly 5 control rows (`CONTROL_ROW_CLASS`: 3.5rem, 5rem from
 * md) plus their 1px separators and the panel's border. Controls, loading,
 * empty and error all fill this same box, so nothing below it moves.
 */
const CONTROLS_LIST_HEIGHT = 'h-[calc(5*3.5rem+7px)] md:h-[calc(5*5rem+7px)]';

/** Skeleton rows shown in the list box while the server's answer is on its way: exactly the box's visible rows. */
const CONTROLS_SKELETON_ROWS = 5;

function controlsTabId(domain: string): string {
  return `domain-${domain.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function ControlsListSkeleton() {
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
  return <StackedRowsPanel rows={rows} />;
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

  let summary: string;
  if (answer.error && !current) summary = 'Controls are unavailable';
  else if (!current) summary = typedQuery ? `Searching for “${typedQuery}”…` : 'Loading…';
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
    body = <StackedRowsPanel rows={controlRows(current.controls, query)} />;
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={tabId =>
          setDomain(categories.find(category => controlsTabId(category.domain) === tabId)?.domain ?? null)
        }
      />
      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:items-center md:justify-between">
        <p className={BODY_TEXT} aria-live="polite">
          {summary}
        </p>
        <div className="w-full md:w-80">
          <SearchInput
            placeholder="Search controls"
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
}: {
  documents: TrustCenterDocument[];
  /** Where a public document opens (`trustCenterDocumentUrl`); `null` → offer a request instead. */
  documentUrl: (document: TrustCenterDocument) => string | null;
  /** Open the ONE access request, optionally for a named document. */
  onRequest: (documentTitle: string | null) => void;
}) {
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

/**
 * A subprocessor's mark, best source first: its own site's icon (the hub looks
 * it up from the website Vanta holds), else the brand logo our icon set has for
 * its name (`brandLogoForName`), else initials — which are also what a site
 * icon that fails to load falls back to.
 */
function subprocessorMark({ name, logoUrl }: TrustCenterSubprocessor): ReactNode {
  if (logoUrl) return <EntityImage src={logoUrl} alt={name} fallbackText={name} sizeClassName="size-6" />;
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
