/**
 * ONE pulse in the library: `animate-pulse` is written only in `skeleton-surface.ts` (`SKELETON_SURFACE_CLASS`
 * for a loading shape, `LIVE_PULSE_CLASS` for a live indicator), no animation duration is set by hand, and a
 * skeleton never pulses inside another one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnifiedSkeleton } from '../components/loading/unified-skeleton';
import { NavigationSidebarGroupedSkeleton } from '../components/navigation/navigation-sidebar-grouped';
import { TextHold } from '../components/ui/layout-hold';
import { LIVE_PULSE_CLASS, SKELETON_SURFACE_CLASS } from '../components/ui/skeleton-surface';

const SRC = join(__dirname, '..');
const OWNER = join('components', 'ui', 'skeleton-surface.ts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

describe('one pulse', () => {
  const files = sourceFiles(SRC).map(path => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));

  it('writes `animate-pulse` only in skeleton-surface.ts', () => {
    const offenders = files
      .filter(f => f.path !== OWNER && /(?<![\w-])animate-pulse(?![\w-])/.test(f.text))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('sets no pulse timing of its own', () => {
    const offenders = files
      .filter(f => /animate-\[pulse|animation:\s*pulse\s|['"]pulse\s+\d/.test(f.text))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('both pulses are the same animation', () => {
    expect(SKELETON_SURFACE_CLASS).toContain('animate-pulse motion-reduce:animate-none');
    expect(LIVE_PULSE_CLASS).toBe('animate-pulse motion-reduce:animate-none');
  });

  it('times no skeleton surface by a transition: `duration-*` sets the pulse duration too', () => {
    // tailwindcss-animate makes `duration-*` set `animation-duration` beside the
    // transition's, so a fade class on a skeleton runs its pulse at the fade's speed.
    const { container } = render(<NavigationSidebarGroupedSkeleton />);
    const surfaces = [...container.querySelectorAll('.ods-skeleton')];
    expect(surfaces.length).toBeGreaterThan(1);
    for (const surface of surfaces) expect(surface.className).not.toMatch(/(?:^|\s)duration-/);
  });

  it('a surface stops the pulse of every surface inside it', () => {
    expect(SKELETON_SURFACE_CLASS).toContain('[&_.ods-skeleton]:animate-none');
    const { container } = render(
      <TextHold>
        words <UnifiedSkeleton as="span" className="w-8" />
      </TextHold>,
    );
    const surfaces = container.querySelectorAll('.ods-skeleton');
    expect(surfaces).toHaveLength(2);
    // The inner one is a descendant of a surface, which the outer surface's `[&_.ods-skeleton]` rule reaches.
    expect(surfaces[1]?.parentElement?.closest('.ods-skeleton')).toBe(surfaces[0]);
  });

  it('draws no block skeleton inside a <p> (the parser would split the paragraph)', () => {
    const paragraph = /<p\b[^>]*>((?:(?!<\/p>)[\s\S]){0,400}?)<\/p>/g;
    const block =
      /<(TextLineSkeleton|TextSkeleton\.\w+|UnifiedSkeleton|MediaSkeleton\.\w+|InteractiveSkeleton\.\w+|div)\b(?![^>]*as="span")/;
    const offenders = files
      .filter(f => f.path.endsWith('.tsx'))
      .filter(f => [...f.text.matchAll(paragraph)].some(m => block.test(m[1] ?? '')))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('a skeleton takes no children', () => {
    // @ts-expect-error a skeleton is a shape, never a frame
    const element = <UnifiedSkeleton>inside</UnifiedSkeleton>;
    expect(element).toBeTruthy();
  });
});
