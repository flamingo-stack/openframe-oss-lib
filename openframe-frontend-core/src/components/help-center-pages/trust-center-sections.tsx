'use client';

/**
 * Section compositions for `<TrustCenterPage>`. Every visual element here is an
 * EXISTING shared lib component — no new primitive, no styled wrapper and no
 * intrinsic interactive/semantic HTML (`__tests__/trust-center-page.test.tsx`
 * statically enforces that). The only own markup is layout `div`s with ODS
 * spacing tokens, the same as `RoadmapPage` / `DeliveryPage`.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Faq } from '../../types/faq';
import {
  TRUST_DOCUMENT_REQUEST_PREFIX,
  trustDocumentContactReason,
  trustFrameworkStatusEntry,
  type TrustCenterAiPractice,
  type TrustCenterContact,
  type TrustCenterControlDomain,
  type TrustCenterDocument,
  type TrustCenterFramework,
  type TrustCenterSubprocessor,
  type TrustFrameworkStatusEntry,
} from '../../types/trust-center';
import { ContactForm } from '../contact/contact-form';
import { EmptyState } from '../empty-state';
import { FaqSection } from '../faq/faq-section';
import { ActivityIcon } from '../icons-v2-generated/charts/activity-icon';
import { EmailShieldIcon } from '../icons-v2-generated/communication/email-shield-icon';
import { FileShieldIcon } from '../icons-v2-generated/documents/file-shield-icon';
import { ShieldCheckIcon } from '../icons-v2-generated/security/shield-check-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { CardSkeletonGrid } from '../loading/card-skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Button } from '../ui/button/button';
import { CardHorizontal } from '../ui/card';
import { DashboardInfoCard } from '../ui/dashboard-info-card';
import { DataTable, useDataTable, type ColumnDef } from '../ui/data-table';
import { FeatureList } from '../ui/feature-list';
import { InfoCard } from '../ui/info-card';
import { ModalV2, ModalV2Content, ModalV2Header, ModalV2Title } from '../ui/modal-v2';
import { SearchInput } from '../ui/search-input';
import { StatusBadge } from '../ui/status-badge';
import { Tag } from '../ui/tag';

/** Status `icon` vocabulary (owned by `TRUST_FRAMEWORK_STATUSES`) → icon component, ONE lookup. */
const FRAMEWORK_ICONS: Record<TrustFrameworkStatusEntry['icon'], typeof ShieldCheckIcon> = {
  'shield-check': ShieldCheckIcon,
  'file-shield': FileShieldIcon,
};

const GRID_CLASSES = 'grid grid-cols-1 gap-[var(--spacing-system-m)] md:grid-cols-2 lg:grid-cols-3';
const STACK_CLASSES = 'flex flex-col gap-[var(--spacing-system-l)]';

// ---------------------------------------------------------------------------
// Frameworks + overview
// ---------------------------------------------------------------------------

export function FrameworkCards({ frameworks }: { frameworks: TrustCenterFramework[] }) {
  if (frameworks.length === 0) return null;
  return (
    <div className={GRID_CLASSES}>
      {frameworks.map(framework => {
        const entry = trustFrameworkStatusEntry(framework.status);
        const Icon = FRAMEWORK_ICONS[entry.icon];
        const hasPercent = typeof framework.percent === 'number';
        return (
          <DashboardInfoCard
            key={framework.id}
            title={framework.label}
            icon={<Icon />}
            titleTag={<StatusBadge text={entry.label} colorScheme={entry.color} variant="button" singleLine />}
            value={framework.reportPeriod ?? entry.label}
            {...(hasPercent ? { showProgress: true, percentage: framework.percent } : {})}
          />
        );
      })}
    </div>
  );
}

export function OverviewSection({
  frameworkCount,
  domainCount,
  lastCheckedLabel,
  policies,
}: {
  frameworkCount: number;
  domainCount: number;
  lastCheckedLabel: string;
  policies: string[];
}) {
  return (
    <div className={STACK_CLASSES}>
      <div className={GRID_CLASSES}>
        <DashboardInfoCard title="Frameworks tracked" value={frameworkCount} />
        <DashboardInfoCard title="Monitored domains" value={domainCount} />
        <DashboardInfoCard title="Last checked" value={lastCheckedLabel} />
      </div>
      {policies.length > 0 && (
        <InfoCard data={{ title: 'Approved policies', items: policies.map(policy => ({ value: policy })) }} />
      )}
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

export function ControlsSection({ domains }: { domains: TrustCenterControlDomain[] }) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => filterControlDomains(domains, query), [domains, query]);
  // Every domain open while searching, so a match is never hidden behind a fold.
  const openValues = useMemo(() => visible.map(domain => domain.domain), [visible]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const searching = query.trim().length > 0;

  return (
    <div className={STACK_CLASSES}>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search controls"
        showDropdown={false}
        debounceMs={0}
      />
      {visible.length === 0 ? (
        <EmptyState
          type="search"
          title="No matching controls"
          description="No monitored control matches your search."
          ctaText="Clear search"
          onCtaClick={() => setQuery('')}
        />
      ) : (
        <Accordion type="multiple" value={searching ? openValues : expanded} onValueChange={setExpanded}>
          {visible.map(domain => (
            <AccordionItem key={domain.domain} value={domain.domain}>
              <AccordionTrigger>
                {domain.domain} ({domain.controls.length})
              </AccordionTrigger>
              <AccordionContent>
                <FeatureList
                  iconBoxSize={40}
                  items={domain.controls.map(control => ({
                    icon: <CheckIcon />,
                    title: control.name,
                    description: control.description ?? '',
                  }))}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Hands the "Request access" cell the page's modal opener without closing the
 *  module-level column defs over render state. */
const DocumentRequestContext = createContext<(title: string) => void>(() => {});

function DocumentActionCell({ document }: { document: TrustCenterDocument }) {
  const requestDocument = useContext(DocumentRequestContext);
  if (document.access === 'public' && document.url) {
    return (
      <Button variant="outline" size="small" href={document.url} openInNewTab>
        View
      </Button>
    );
  }
  return (
    <Button variant="outline" size="small" onClick={() => requestDocument(document.title)}>
      Request access
    </Button>
  );
}

function CellText({ primary, secondary }: { primary: string; secondary?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-ods-text-primary text-h4">{primary}</span>
      {secondary ? <span className="truncate text-ods-text-secondary text-h6">{secondary}</span> : null}
    </div>
  );
}

const DOCUMENT_COLUMNS: ColumnDef<TrustCenterDocument>[] = [
  {
    id: 'title',
    header: 'Document',
    enableSorting: false,
    cell: ({ row }) => <CellText primary={row.original.title} secondary={row.original.kind} />,
    meta: { width: 'flex-1 min-w-0' },
  },
  {
    id: 'access',
    header: 'Access',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.access === 'public' ? (
        <Tag variant="success" label="Public" />
      ) : (
        <Tag variant="outline" label="On request" />
      ),
    meta: { width: 'w-40', hideAt: 'md' },
  },
  {
    id: 'action',
    header: '',
    enableSorting: false,
    cell: ({ row }) => <DocumentActionCell document={row.original} />,
    meta: { width: 'w-44', align: 'right' },
  },
];

const documentRowId = (row: TrustCenterDocument) => row.title;

export function DocumentsSection({
  documents,
  onRequestDocument,
}: {
  documents: TrustCenterDocument[];
  onRequestDocument: (title: string) => void;
}) {
  const table = useDataTable<TrustCenterDocument>({
    data: documents,
    columns: DOCUMENT_COLUMNS,
    getRowId: documentRowId,
    enableSorting: false,
  });
  return (
    <DocumentRequestContext.Provider value={onRequestDocument}>
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body />
      </DataTable>
    </DocumentRequestContext.Provider>
  );
}

/** The gated-document request: the existing contact flow (`/api/contact`), kept
 *  on the page (`successRedirectUrl=""`). */
export function DocumentRequestModal({
  documentTitle,
  onClose,
}: {
  /** The requested document, or null when the modal is closed. */
  documentTitle: string | null;
  onClose: () => void;
}) {
  const reason = documentTitle ? trustDocumentContactReason(documentTitle) : TRUST_DOCUMENT_REQUEST_PREFIX;
  return (
    <ModalV2 isOpen={documentTitle !== null} onClose={onClose} size="medium">
      <ModalV2Header>
        <ModalV2Title>Request {documentTitle ?? 'document'}</ModalV2Title>
      </ModalV2Header>
      <ModalV2Content>
        {documentTitle !== null && (
          <ContactForm
            title=""
            noBorder
            noPadding
            prefilledReason={reason}
            helpCategoryOptions={[reason]}
            submitLabel="Request access"
            successRedirectUrl=""
            successToastMessage="Thanks — we'll follow up by email."
            onSubmitSuccess={onClose}
          />
        )}
      </ModalV2Content>
    </ModalV2>
  );
}

// ---------------------------------------------------------------------------
// Subprocessors, AI, FAQ
// ---------------------------------------------------------------------------

const SUBPROCESSOR_COLUMNS: ColumnDef<TrustCenterSubprocessor>[] = [
  {
    id: 'name',
    header: 'Subprocessor',
    enableSorting: false,
    cell: ({ row }) => <CellText primary={row.original.name} />,
    meta: { width: 'flex-1 min-w-0' },
  },
  {
    id: 'purpose',
    header: 'Purpose',
    enableSorting: false,
    cell: ({ row }) => <CellText primary={row.original.purpose} />,
    meta: { width: 'flex-1 min-w-0' },
  },
  {
    id: 'location',
    header: 'Location',
    enableSorting: false,
    cell: ({ row }) => <CellText primary={row.original.location} />,
    meta: { width: 'w-32', hideAt: 'md' },
  },
  {
    id: 'category',
    header: 'Category',
    enableSorting: false,
    cell: ({ row }) => <Tag variant="outline" label={row.original.category} />,
    meta: { width: 'w-40', align: 'right' },
  },
];

const subprocessorRowId = (row: TrustCenterSubprocessor) => row.name;

export function SubprocessorsSection({ subprocessors }: { subprocessors: TrustCenterSubprocessor[] }) {
  const table = useDataTable<TrustCenterSubprocessor>({
    data: subprocessors,
    columns: SUBPROCESSOR_COLUMNS,
    getRowId: subprocessorRowId,
    enableSorting: false,
  });
  return (
    <DataTable table={table}>
      <DataTable.Header />
      <DataTable.Body />
    </DataTable>
  );
}

export function AiSection({ practices }: { practices: TrustCenterAiPractice[] }) {
  return (
    <InfoCard
      data={{
        title: 'AI practices',
        icon: <ShieldCheckIcon />,
        items: practices.map(practice => ({ label: practice.label, value: practice.value })),
      }}
    />
  );
}

export function FaqTab({ faqs }: { faqs: Faq[] }) {
  return <FaqSection initialFaqs={faqs} heading={null} />;
}

// ---------------------------------------------------------------------------
// Footer + loading
// ---------------------------------------------------------------------------

function FooterRow({ card, action }: { card: ReactNode; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-s)] md:flex-row md:items-center">
      <div className="min-w-0 flex-1">{card}</div>
      <div className="flex shrink-0 flex-wrap gap-[var(--spacing-system-s)]">{action}</div>
    </div>
  );
}

export function ContactFooter({ contact }: { contact: TrustCenterContact }) {
  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] lg:grid-cols-2">
      <FooterRow
        card={
          <CardHorizontal
            icon={<EmailShieldIcon />}
            title="Security contact"
            description={`Report a vulnerability or ask a security question: ${contact.securityEmail}`}
          />
        }
        action={
          <>
            <Button variant="outline" href={`mailto:${contact.securityEmail}`}>
              Email security
            </Button>
            {contact.disclosureUrl ? (
              <Button variant="transparent" href={contact.disclosureUrl} openInNewTab>
                Disclosure policy
              </Button>
            ) : null}
          </>
        }
      />
      {contact.statusPageUrl ? (
        <FooterRow
          card={
            <CardHorizontal
              icon={<ActivityIcon />}
              title="System status"
              description="Live uptime and incident history."
            />
          }
          action={
            <Button variant="outline" href={contact.statusPageUrl} openInNewTab>
              Status page
            </Button>
          }
        />
      ) : null}
    </div>
  );
}

const NO_DOCUMENTS: TrustCenterDocument[] = [];

export function TrustCenterSkeleton() {
  // `DataTable.Body loading` draws the table's own skeleton rows (it needs a
  // table instance for its column layout — an empty one with the real columns).
  const table = useDataTable<TrustCenterDocument>({
    data: NO_DOCUMENTS,
    columns: DOCUMENT_COLUMNS,
    getRowId: documentRowId,
    enableSorting: false,
  });
  return (
    <div className={STACK_CLASSES}>
      <CardSkeletonGrid count={3} variant="category" />
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body loading skeletonRows={4} />
      </DataTable>
    </div>
  );
}
