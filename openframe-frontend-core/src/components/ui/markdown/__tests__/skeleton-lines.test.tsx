import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownEngineSkeleton } from '../engine';

/** Each text bar of the markup and its line count: a bar is a run of `h-[0.7lh]` lines inside one block. */
const bars = (html: string) =>
  html
    .split(/(?=<div aria-hidden="true" class="[^"]*flex-col)/)
    .slice(1)
    .map(chunk => ({
      className: /class="([^"]*)"/.exec(chunk)?.[1] ?? '',
      lines: chunk.split('h-[0.7lh]').length - 1,
    }));

describe('MarkdownEngineSkeleton paragraph lines', () => {
  it('draws one paragraph of a fixed number of lines', () => {
    expect(bars(renderToStaticMarkup(<MarkdownEngineSkeleton lines={4} />)).map(bar => bar.lines)).toEqual([4]);
  });

  it('draws the typical lines of each width when they change with it', () => {
    const drawn = bars(renderToStaticMarkup(<MarkdownEngineSkeleton lines={{ phone: 12, md: 7, lg: 5 }} />));
    // One bar per step of the content area (phone, from content-md, from content-lg); exactly one shows at a width.
    expect(drawn.map(bar => bar.lines)).toEqual([12, 7, 5]);
    expect(drawn[0].className).toContain('content-md:hidden');
    expect(drawn[1].className).toContain('content-md:flex');
    expect(drawn[2].className).toContain('content-lg:flex');
  });
});
