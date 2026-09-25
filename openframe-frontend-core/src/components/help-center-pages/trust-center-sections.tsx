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

import { useMemo, type ReactNode } from 'react';
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
import { STICKY_HEADER_OFFSET_PX } from '../../utils/same-page-hash-nav';
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
import { Button } from '../ui/button/button';
import { EntityImage } from '../ui/entity-image';
import { LoadError } from '../ui/error-state';
import { ModalV2, ModalV2Content, ModalV2Header, ModalV2Title } from '../ui/modal-v2';
import { StackedRowsPanel, type PanelRow } from '../ui/stacked-rows-panel';
import { StatusBadge } from '../ui/status-badge';
import { Tag } from '../ui/tag';

/** Status `icon` vocabulary (owned by `TRUST_FRAMEWORK_STATUSES`) → icon component, ONE lookup. */
const FRAMEWORK_ICONS: Record<TrustFrameworkStatusEntry['icon'], typeof ShieldCheckIcon> = {
  'shield-check': ShieldCheckIcon,
  'file-shield': FileShieldIcon,
};

const STACK_CLASSES = 'flex flex-col gap-[var(--spacing-system-l)]';
const TWO_COLUMN_GRID = 'grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2';
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
  aside,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  /** Right-aligned header content (a search box, a CTA). */
  aside?: ReactNode;
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
      <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
          <h2 id={headingId} className={SECTION_HEADING_CLASS}>
            {title}
          </h2>
          {lead ? <p className={BODY_TEXT}>{lead}</p> : null}
        </div>
        {aside ? <div className="w-full shrink-0 md:w-80">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// AI & data use
// ---------------------------------------------------------------------------

/**
 * The data-use commitment first (success shield), then the other practices —
 * the page's ONE row style (`StackedRowsPanel`), full sentences wrapped.
 */
export function AiSection({ practices }: { practices: TrustCenterAiPractice[] }) {
  const ordered = [...practices].sort((a, b) => Number(Boolean(b.commitment)) - Number(Boolean(a.commitment)));
  const rows: PanelRow[] = ordered.map(practice => ({
    id: practice.label,
    columns: [
      practice.commitment
        ? {
            key: 'practice',
            leadingIcon: <ShieldCheckIcon className="text-ods-success" role="img" aria-label="Commitment" />,
            value: practice.value,
            label: practice.label,
            wrap: true,
          }
        : {
            key: 'practice',
            leadingIcon: <BrainAIIcon aria-hidden="true" />,
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
  const searching = query.trim().length > 0;
  const results = search.results;
  const total = useMemo(() => domains.reduce((sum, domain) => sum + domain.controls.length, 0), [domains]);
  const matches = results?.reduce((sum, domain) => sum + domain.controls.length, 0) ?? 0;

  return (
    <div className={STACK_CLASSES}>
      {searching && results !== null ? (
        <p className={BODY_TEXT} aria-live="polite">
          {matches > 0
            ? `${matches} of ${countLabel(total, 'control')} match “${query.trim()}”`
            : `No controls match “${query.trim()}”`}
        </p>
      ) : null}

      {searching && search.error ? (
        <LoadError message="Could not search the controls" onRetry={search.onRetry} />
      ) : searching && results === null ? (
        <CardSkeletonGrid count={2} variant="category" />
      ) : searching && results?.length === 0 ? (
        <ListEmptyState
          isFiltered
          filtered={{
            title: 'No matching controls',
            description: 'Try another word, or ask our security team directly.',
            clearText: 'Show all controls',
          }}
          onClearFilters={() => onQueryChange('')}
          empty={{ title: 'No controls', description: '' }}
        />
      ) : searching ? (
        // Search: ONE flat list, grouped by category, every match visible.
        <div className={STACK_CLASSES}>
          {(results ?? []).map(domain => (
            <StackedRowsPanel
              key={domain.domain}
              title={`${domain.domain} · ${domain.controls.length}`}
              rows={controlRows(domain.controls, query)}
            />
          ))}
        </div>
      ) : (
        // Browse: every category with ALL its controls, always — nothing to expand.
        <div className={TWO_COLUMN_GRID}>
          {domains.map(domain => (
            <StackedRowsPanel
              key={domain.domain}
              title={`${domain.domain} · ${domain.controls.length}`}
              rows={controlRows(domain.controls)}
            />
          ))}
        </div>
      )}
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

export function SubprocessorsSection({ subprocessors }: { subprocessors: TrustCenterSubprocessor[] }) {
  const rows: PanelRow[] = subprocessors.map(subprocessor => ({
    id: subprocessor.name,
    columns: [
      {
        key: 'name',
        leadingIcon: <EntityImage alt={subprocessor.name} fallbackText={subprocessor.name} sizeClassName="size-10" />,
        value: subprocessor.name,
        label: subprocessor.purpose,
        href: subprocessor.url ?? undefined,
      },
      { key: 'location', value: subprocessor.location, label: 'Location', hideAt: 'md', width: 'w-44 shrink-0' },
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
