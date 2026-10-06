import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { NavMenu } from '../../../types/navigation';
import { resolveActiveSection, useActiveSection } from '../use-active-section';

const menus: NavMenu[] = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'product', label: 'Product', match: ['/openframe', '/roadmap'], columns: [] },
  { id: 'pricing', label: 'Pricing', href: '/pricing' },
  { id: 'pricing-teams', label: 'Teams', href: '/pricing/teams' },
  { id: 'docs', label: 'Docs', href: 'https://docs.example.com/pricing' },
  { id: 'anchor', label: 'Agents', href: '/agents#mingo' },
];

describe('resolveActiveSection', () => {
  it('matches a prefix exactly and under it, never a longer word', () => {
    expect(resolveActiveSection(menus, '/pricing')).toBe('pricing');
    expect(resolveActiveSection(menus, '/pricing/annual')).toBe('pricing');
    expect(resolveActiveSection(menus, '/pricing-old')).toBeNull();
  });

  it('matches "/" only on the root', () => {
    expect(resolveActiveSection(menus, '/')).toBe('home');
    expect(resolveActiveSection(menus, '/unknown')).toBeNull();
  });

  it('lets the longest prefix win', () => {
    expect(resolveActiveSection(menus, '/pricing/teams/seats')).toBe('pricing-teams');
  });

  it('reads `match` before `href`, any of its prefixes', () => {
    expect(resolveActiveSection(menus, '/roadmap/2026')).toBe('product');
    expect(resolveActiveSection(menus, '/openframe')).toBe('product');
  });

  it('ignores absolute URLs, a query, an anchor and a trailing slash', () => {
    expect(resolveActiveSection([menus[4]], '/pricing')).toBeNull();
    expect(resolveActiveSection(menus, '/agents')).toBe('anchor');
    expect(resolveActiveSection(menus, '/pricing/?plan=pro')).toBe('pricing');
  });

  it('is null without a pathname', () => {
    expect(resolveActiveSection(menus, null)).toBeNull();
    expect(resolveActiveSection(menus, '')).toBeNull();
  });
});

describe('useActiveSection', () => {
  it('follows the pathname', () => {
    const { result, rerender } = renderHook(({ pathname }) => useActiveSection(menus, pathname), {
      initialProps: { pathname: '/pricing' },
    });
    expect(result.current).toBe('pricing');
    rerender({ pathname: '/openframe/agents' });
    expect(result.current).toBe('product');
  });
});
