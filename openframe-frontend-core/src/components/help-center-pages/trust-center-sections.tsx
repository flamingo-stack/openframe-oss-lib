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
 * certified proof above roadmap items, controls as a grid of category cards with
 * "View all" in a drawer, and a controls SEARCH that filters one flat, grouped,
 * counted list — never collapsible panels whose open state fights the query.
 */

import { useMemo, useState, type ReactNode } from 'react';
import type { Faq } from '../../types/faq';
import {
  TRUST_DOCUMENT_REQUEST_PREFIX,
  trustDocumentContactReason,
  trustFrameworkStatusEntry,
  type TrustCenterAiPractice,
  type TrustCenterContact,
  type TrustCenterControl,
  type TrustCenterControlDomain,
  type TrustCenterDocument,
  type TrustCenterFramework,
  type TrustCenterSubprocessor,
  type TrustFrameworkStatusEntry,
} from '../../types/trust-center';
import { ContactForm } from '../contact/contact-form';
import { FaqSection } from '../faq/faq-section';
import { ActivityIcon } from '../icons-v2-generated/charts/activity-icon';
import { EmailShieldIcon } from '../icons-v2-generated/communication/email-shield-icon';
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
import { CardHorizontal } from '../ui/card';
import { DashboardInfoCard } from '../ui/dashboard-info-card';
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from '../ui/drawer';
import { EntityImage } from '../ui/entity-image';
import { FeatureList } from '../ui/feature-list';
import { ModalV2, ModalV2Content, ModalV2Header, ModalV2Title } from '../ui/modal-v2';
import { StackedRowsPanel, type PanelRow } from '../ui/stacked-rows-panel';
import { Tag } from '../ui/tag';

/** Status `icon` vocabulary (owned by `TRUST_FRAMEWORK_STATUSES`) → icon component, ONE lookup. */
const FRAMEWORK_ICONS: Record<TrustFrameworkStatusEntry['icon'], typeof ShieldCheckIcon> = {
  'shield-check': ShieldCheckIcon,
  'file-shield': FileShieldIcon,
};

/** Controls shown per category card before "View all". */
const CONTROLS_PER_CARD = 3;

const STACK_CLASSES = 'flex flex-col gap-[var(--spacing-system-l)]';
const TWO_COLUMN_GRID = 'grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2';
const BODY_TEXT = 'text-h6 text-ods-text-secondary';

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
    <section id={id} aria-labelledby={headingId} className="flex scroll-mt-24 flex-col gap-[var(--spacing-system-m)]">
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

/** The data-use commitment boxed first (accent edge), then the rest of the practices as compact cards. */
export function AiSection({ practices }: { practices: TrustCenterAiPractice[] }) {
  const commitment = practices.find(practice => practice.commitment);
  const rest = practices.filter(practice => practice !== commitment);
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      {commitment ? (
        <CardHorizontal
          icon={<ShieldCheckIcon className="text-ods-success" />}
          title={commitment.value}
          description={commitment.label}
          className="border-l-ods-success"
        />
      ) : null}
      {rest.length > 0 ? (
        <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-3">
          {rest.map(practice => (
            <CardHorizontal
              key={practice.label}
              icon={<BrainAIIcon />}
              title={practice.label}
              description={practice.value}
              borderLeft={false}
              className="h-full items-start border border-ods-border"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

/**
 * Real proof first: certified / in-audit / in-progress frameworks as tiles
 * (status as the small label, framework as the value — never the status twice).
 * Planned frameworks are one roadmap line, not tiles that push proof down.
 */
export function ComplianceSection({ frameworks }: { frameworks: TrustCenterFramework[] }) {
  const active = frameworks.filter(framework => framework.status !== 'planned');
  const planned = frameworks.filter(framework => framework.status === 'planned');
  return (
    <div className={STACK_CLASSES}>
      {active.length > 0 ? (
        <div className={TWO_COLUMN_GRID}>
          {active.map(framework => {
            const entry = trustFrameworkStatusEntry(framework.status);
            const Icon = FRAMEWORK_ICONS[entry.icon];
            const hasPercent = typeof framework.percent === 'number';
            return (
              <DashboardInfoCard
                key={framework.id}
                title={entry.label}
                icon={<Icon />}
                value={framework.label}
                subValue={framework.reportPeriod ?? undefined}
                {...(hasPercent ? { showProgress: true, percentage: framework.percent } : {})}
              />
            );
          })}
        </div>
      ) : null}
      {planned.length > 0 ? (
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-s)]">
          <span className={BODY_TEXT}>On our roadmap:</span>
          {planned.map(framework => (
            <Tag key={framework.id} variant="outline" label={framework.label} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/** Client-side filter over control name + description. Exported for tests. */
export function filterControlDomains(domains: TrustCenterControlDomain[], query: string): TrustCenterControlDomain[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return domains;
  return domains
    .map(domain => ({
      ...domain,
      controls: domain.controls.filter(
        control =>
          control.name.toLowerCase().includes(needle) || (control.description ?? '').toLowerCase().includes(needle),
      ),
    }))
    .filter(domain => domain.controls.length > 0);
}

/** The query's first match in `text`, emphasised (ODS accent). */
function highlight(text: string, query: string): ReactNode {
  const needle = query.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <strong className="text-ods-accent">{text.slice(at, at + needle.length)}</strong>
      {text.slice(at + needle.length)}
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
        leadingIcon: <CheckIcon className="text-ods-success" aria-label="Passing" />,
        value: highlight(control.name, query),
        label: control.description ?? undefined,
      },
    ],
  }));
}

function countLabel(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

export function ControlsSection({
  domains,
  query,
  onQueryChange,
}: {
  domains: TrustCenterControlDomain[];
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const [openDomain, setOpenDomain] = useState<TrustCenterControlDomain | null>(null);
  const searching = query.trim().length > 0;
  const results = useMemo(() => filterControlDomains(domains, query), [domains, query]);
  const total = useMemo(() => domains.reduce((sum, domain) => sum + domain.controls.length, 0), [domains]);
  const matches = results.reduce((sum, domain) => sum + domain.controls.length, 0);

  return (
    <div className={STACK_CLASSES}>
      {searching ? (
        <p className={BODY_TEXT} aria-live="polite">
          {matches > 0
            ? `${matches} of ${countLabel(total, 'control')} match “${query.trim()}”`
            : `No controls match “${query.trim()}”`}
        </p>
      ) : null}

      {searching && results.length === 0 ? (
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
          {results.map(domain => (
            <StackedRowsPanel
              key={domain.domain}
              title={`${domain.domain} · ${domain.controls.length}`}
              rows={controlRows(domain.controls, query)}
            />
          ))}
        </div>
      ) : (
        // Browse: a grid of category cards, each with its first controls + "View all".
        <div className={TWO_COLUMN_GRID}>
          {domains.map(domain => {
            const hidden = domain.controls.length - CONTROLS_PER_CARD;
            return (
              <div key={domain.domain} className="flex flex-col gap-[var(--spacing-system-xs)]">
                <StackedRowsPanel
                  title={`${domain.domain} · ${domain.controls.length}`}
                  rows={controlRows(domain.controls.slice(0, CONTROLS_PER_CARD))}
                />
                {hidden > 0 ? (
                  <Button
                    variant="transparent"
                    size="small"
                    onClick={() => setOpenDomain(domain)}
                    className="self-start"
                    aria-label={`View all ${domain.controls.length} ${domain.domain} controls`}
                  >
                    {`View all ${domain.controls.length} controls`}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <Drawer open={openDomain !== null} onOpenChange={open => (open ? undefined : setOpenDomain(null))}>
        <DrawerContent
          side="right"
          offsetHeader
          aria-describedby={undefined}
          className="w-[calc(100vw-2rem)] sm:w-[32rem] sm:max-w-[calc(100vw-2rem)]"
        >
          <DrawerHeader>
            <DrawerTitle>{openDomain?.domain ?? ''}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            {openDomain ? (
              <FeatureList
                iconBoxSize={40}
                items={openDomain.controls.map(control => ({
                  icon: <CheckIcon className="text-ods-success" />,
                  title: control.name,
                  description: control.description ?? '',
                }))}
              />
            ) : null}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function DocumentsSection({
  documents,
  onRequest,
}: {
  documents: TrustCenterDocument[];
  /** Open the ONE access request, optionally for a named document. */
  onRequest: (documentTitle: string | null) => void;
}) {
  const rows: PanelRow[] = documents.map(document => {
    const gated = document.access === 'request';
    return {
      id: document.title,
      columns: [
        {
          key: 'document',
          leadingIcon: gated ? <LockIcon aria-label="Available on request" /> : <FileIcon aria-label="Public" />,
          value: document.title,
          label: gated ? `${document.kind} · available on request` : `${document.kind} · public`,
        },
        {
          key: 'action',
          width: 'shrink-0',
          align: 'right',
          content:
            gated || !document.url ? (
              <Button
                variant="outline"
                size="small"
                onClick={() => onRequest(document.title)}
                aria-label={`Request ${document.title}`}
              >
                Request
              </Button>
            ) : (
              <Button variant="outline" size="small" href={document.url} aria-label={`View ${document.title}`}>
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
// Subprocessors, FAQ
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
      { key: 'location', value: subprocessor.location, label: 'Location', hideAt: 'md', width: 'w-40 shrink-0' },
      {
        key: 'category',
        width: 'shrink-0',
        align: 'right',
        // Phones keep name + purpose readable; the category is a desktop column.
        hideAt: 'md',
        content: <Tag variant="outline" label={subprocessor.category} />,
      },
    ],
  }));
  return <StackedRowsPanel rows={rows} />;
}

export function FaqList({ faqs }: { faqs: Faq[] }) {
  return <FaqSection initialFaqs={faqs} heading={null} />;
}

// ---------------------------------------------------------------------------
// Contact + loading
// ---------------------------------------------------------------------------

export function ContactSection({ contact }: { contact: TrustCenterContact }) {
  return (
    <div className={TWO_COLUMN_GRID}>
      <div className="flex flex-col gap-[var(--spacing-system-s)]">
        <CardHorizontal
          icon={<EmailShieldIcon />}
          title="Report a vulnerability"
          description={`Security questions and responsible disclosure: ${contact.securityEmail}`}
        />
        <div className="flex flex-wrap gap-[var(--spacing-system-s)]">
          <Button variant="outline" href={`mailto:${contact.securityEmail}`}>
            Email security
          </Button>
          {contact.disclosureUrl ? (
            <Button variant="transparent" href={contact.disclosureUrl}>
              Disclosure policy
            </Button>
          ) : null}
        </div>
      </div>
      {contact.statusPageUrl ? (
        <div className="flex flex-col gap-[var(--spacing-system-s)]">
          <CardHorizontal
            icon={<ActivityIcon />}
            title="System status"
            description="Live uptime and incident history."
          />
          <div className="flex flex-wrap gap-[var(--spacing-system-s)]">
            <Button variant="outline" href={contact.statusPageUrl} openInNewTab>
              Status page
            </Button>
          </div>
        </div>
      ) : null}
    </div>
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
