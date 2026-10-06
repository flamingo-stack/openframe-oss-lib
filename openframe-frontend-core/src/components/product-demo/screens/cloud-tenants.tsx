'use client';

import { useMemo } from 'react';
import { TenantsTableView } from '../../features/cloud-tenants';
import { useProductDemoCast } from '../cast';
import { buildCloudTenantsFixture } from '../fixtures/cloud-tenants';
import type { ProductScreenViewProps } from '../types';

/** A picture has nowhere to go: every row leads to the same inert address. */
const getHref = () => '#';

/**
 * The product's Cloud Tenant Management list without its title row and its
 * empty search field (the job is named above the picture): the tenants table,
 * each with its directory, its customer and what the last access probe found.
 */
export default function CloudTenantsScreen(_props: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildCloudTenantsFixture(cast), [cast]);
  const table = <TenantsTableView rows={fixture.rows} getHref={getHref} now={fixture.now} />;

  return <div className="h-full bg-ods-bg p-[var(--spacing-system-l)]">{table}</div>;
}
