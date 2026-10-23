'use client';

import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { DEMO_ORGANIZATIONS, DEMO_PEOPLE, type DemoOrganizationKey, type DemoPersonKey } from './fixtures/shared';

/**
 * What a host adds to the product screens' cast. The people and customers of
 * the stories are the library's; their PICTURES are the host's, because the
 * library holds no storage address:
 *   - `people`: a portrait by persona slug (`tech`, `leo`, `alex-reed`, ...);
 *   - `organizations`: a logo by customer key (`acme`, `northbridge`,
 *     `harbor`).
 * Anything left out falls back to initials, the way the product draws a
 * person or a customer that has no picture.
 */
export interface ProductDemoCast {
  people?: Readonly<Record<string, { avatarUrl?: string | null } | undefined>>;
  organizations?: Readonly<Record<string, { logoUrl?: string | null } | undefined>>;
}

export type DemoPersonRole = (typeof DEMO_PEOPLE)[DemoPersonKey]['role'];

export interface DemoPerson {
  id: string;
  slug: string;
  name: string;
  initials: string;
  /** A technician works in the product; an end user is the customer's employee. */
  role: DemoPersonRole;
  /** The host's portrait; absent: the product draws its initials. */
  avatarUrl?: string;
}

export interface DemoOrganization {
  id: string;
  name: string;
  initials: string;
  domain: string;
  /** The host's logo; absent: the product draws the customer's initials. */
  logoUrl?: string;
}

/** The cast a fixture is built from: every person and customer, with their pictures resolved. */
export interface DemoCast {
  person: (key: DemoPersonKey) => DemoPerson;
  organization: (key: DemoOrganizationKey) => DemoOrganization;
}

/** The cast with the host's pictures applied; no argument: initials everywhere. */
export function resolveProductDemoCast(cast?: ProductDemoCast | null): DemoCast {
  return {
    person: key => {
      const person = DEMO_PEOPLE[key];
      return { ...person, avatarUrl: cast?.people?.[person.slug]?.avatarUrl ?? undefined };
    },
    organization: key => ({
      ...DEMO_ORGANIZATIONS[key],
      logoUrl: cast?.organizations?.[key]?.logoUrl ?? undefined,
    }),
  };
}

const ProductDemoCastContext = createContext<ProductDemoCast | null>(null);

/**
 * Gives every product screen under it the host's pictures of the cast. Mount
 * it once around the screens of a page (an explorer, a hero window); a screen
 * outside it still renders, with initials.
 */
export function ProductDemoCastProvider({ cast, children }: { cast: ProductDemoCast | null; children: ReactNode }) {
  return <ProductDemoCastContext.Provider value={cast}>{children}</ProductDemoCastContext.Provider>;
}

/** The resolved cast for a screen's fixture; stable while the host's cast is. */
export function useProductDemoCast(): DemoCast {
  const cast = useContext(ProductDemoCastContext);
  return useMemo(() => resolveProductDemoCast(cast), [cast]);
}
