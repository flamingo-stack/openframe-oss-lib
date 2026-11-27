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
 *
 * The wide rendering is the product's grid (one bordered block of 48px one-line
 * rows): its four columns fit the readable layout width. The narrow rendering
 * (a carousel card, a phone's or a tablet's width) keeps the card rows: the
 * grid would be cut past the card's edge, and a picture cannot scroll.
 */
export default function CloudTenantsScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildCloudTenantsFixture(cast), [cast]);
  const table = (
    <TenantsTableView rows={fixture.rows} getHref={getHref} now={fixture.now} layout={compact ? 'cards' : 'grid'} />
  );

  return <div className="h-full bg-ods-bg p-[var(--spacing-system-l)]">{table}</div>;
}
