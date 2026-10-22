'use client';

import { useMemo } from 'react';
import type { NavMenu } from '../../types/navigation';

/** The path of an internal href, without its query or `#anchor`. `null` for an
 *  absolute URL: another site is never the current section. */
function pathOf(href: string | undefined): string | null {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null;
  const path = href.split(/[?#]/)[0];
  return path.length > 1 ? path.replace(/\/+$/, '') : '/';
}

/** Boundary-aware prefix test: `/pricing` holds `/pricing` and `/pricing/x`,
 *  never `/pricing-old`; `/` holds only `/`. */
function prefixHolds(prefix: string, pathname: string): boolean {
  if (prefix === '/') return pathname === '/';
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Pure rule behind {@link useActiveSection}: the id of the menu whose `match`
 * prefixes (else its `href`) hold the pathname. The longest prefix wins, the
 * first menu on a tie; `null` when none holds it.
 */
export function resolveActiveSection(menus: readonly NavMenu[], pathname: string | null | undefined): string | null {
  const current = pathOf(pathname ?? undefined);
  if (!current) return null;
  let best: { id: string; length: number } | null = null;
  for (const menu of menus) {
    const prefixes = menu.match?.length ? menu.match : [menu.href];
    for (const raw of prefixes) {
      const prefix = pathOf(raw);
      if (!prefix || !prefixHolds(prefix, current)) continue;
      if (!best || prefix.length > best.length) best = { id: menu.id, length: prefix.length };
    }
  }
  return best?.id ?? null;
}

/** The id of the top-level menu the current page belongs to, or `null`. */
export function useActiveSection(menus: readonly NavMenu[], pathname: string | null | undefined): string | null {
  return useMemo(() => resolveActiveSection(menus, pathname), [menus, pathname]);
}
