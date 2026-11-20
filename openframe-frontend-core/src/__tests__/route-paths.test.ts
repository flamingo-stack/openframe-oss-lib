import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { isPageFile, isPrivateSegment, routeSegmentPaths } = createRequire(import.meta.url)(
  '../../scripts/route-paths.cjs',
) as {
  isPageFile: (name: string) => boolean;
  isPrivateSegment: (name: string) => boolean;
  routeSegmentPaths: (segments: readonly string[]) => string[];
};

describe('route-paths', () => {
  it('knows a page file by its name', () => {
    expect(isPageFile('page.tsx')).toBe(true);
    expect(isPageFile('page.mjs')).toBe(true);
    expect(isPageFile('new-customer-page.tsx')).toBe(false);
    expect(isPageFile('layout.tsx')).toBe(false);
  });

  it('knows a private folder', () => {
    expect(isPrivateSegment('_lib')).toBe(true);
    expect(isPrivateSegment('devices')).toBe(false);
  });

  it('spells a static route without its groups and slots', () => {
    expect(routeSegmentPaths(['(app)', 'devices', 'details'])).toEqual(['/devices/details']);
    expect(routeSegmentPaths(['@modal', 'settings'])).toEqual(['/settings']);
    expect(routeSegmentPaths([])).toEqual(['/']);
  });

  it('gives a dynamic route a sample path and the static part before it', () => {
    expect(routeSegmentPaths(['(app)', 'devices', 'details', '[id]'])).toEqual([
      '/devices/details/x',
      '/devices/details',
    ]);
    expect(routeSegmentPaths(['(landing)', '[slug]'])).toEqual(['/x', '/']);
  });
});
