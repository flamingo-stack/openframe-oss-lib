'use client';

import { TenantsTableView } from '../../features/cloud-tenants';
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon';
import { SearchIcon } from '../../icons-v2-generated/interface/search-icon';
import { PageLayout } from '../../layout/page-layout';
import { Input } from '../../ui/input';
import type { PageActionButton } from '../../ui/page-actions';
import { CLOUD_TENANTS_FIXTURE } from '../fixtures/cloud-tenants';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

/** A picture has nowhere to go: every row leads to the same inert address. */
const getHref = () => '#';

/** The "Connect Tenant" split button of the product's tenants list. */
const PAGE_ACTIONS: PageActionButton[] = [
  {
    label: 'Connect Tenant',
    variant: 'outline',
    onClick: noop,
    iconAction: {
      icon: <ArrowRightUpIcon className="h-5 w-5" />,
      'aria-label': 'Open Connect Tenant in a new tab',
      onClick: noop,
    },
  },
];

/**
 * The product's Cloud Tenant Management list: the search and the tenants
 * table. The narrow rendering is the table alone.
 */
export default function CloudTenantsScreen({ compact = false }: ProductScreenViewProps) {
  const table = (
    <TenantsTableView rows={CLOUD_TENANTS_FIXTURE.rows} getHref={getHref} now={CLOUD_TENANTS_FIXTURE.now} />
  );

  if (compact) {
    return <div className="h-full bg-ods-bg p-[var(--spacing-system-l)]">{table}</div>;
  }

  return (
    <div className="h-full bg-ods-bg px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
      <PageLayout
        title="Cloud Tenant Management"
        actions={PAGE_ACTIONS}
        actionsVariant="icon-buttons"
        contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      >
        <Input
          placeholder="Search for Tenant"
          value=""
          onChange={noop}
          startAdornment={<SearchIcon className="h-4 w-4 content-md:h-6 content-md:w-6" />}
          aria-label="Search for Tenant"
        />
        {table}
      </PageLayout>
    </div>
  );
}
