import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ElestioLogoIcon } from '../icons-v2-generated/brand-logos/elestio-logo-icon';

/**
 * An icon that names a mask or a gradient must not share those ids with another
 * copy of itself. A page drew this mark twice (a mobile and a desktop layout,
 * one hidden by CSS); with fixed ids the visible copy's mask pointed at the
 * hidden one and the logo was drawn as a red bar.
 */
describe('icons with ids', () => {
  it('gives each instance its own ids and points its references at them', () => {
    const markup = renderToStaticMarkup(
      <>
        <ElestioLogoIcon />
        <ElestioLogoIcon />
      </>,
    );
    const copies = markup.split('</svg>').filter(part => part.includes('<svg'));
    expect(copies).toHaveLength(2);
    const idsOf = (svg: string) => [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
    const refsOf = (svg: string) => [...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);
    const [first, second] = copies.map(idsOf);
    expect(first.length).toBeGreaterThan(0);
    expect(first.filter(id => second.includes(id))).toEqual([]);
    for (const svg of copies) {
      const refs = refsOf(svg);
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(idsOf(svg)).toContain(ref);
    }
  });
});
