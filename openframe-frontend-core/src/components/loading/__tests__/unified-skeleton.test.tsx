import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UnifiedSkeleton } from '../unified-skeleton';

describe('UnifiedSkeleton sizing', () => {
  it('applies the default height when nothing sizes the box', () => {
    const { container } = render(<UnifiedSkeleton className="w-full" />);
    expect(container.firstElementChild?.className).toMatch(/\bh-4\b/);
  });

  it('lets an aspect-* utility size the box instead of the default height', () => {
    const { container } = render(<UnifiedSkeleton className="aspect-video w-full" />);
    expect(container.firstElementChild?.className).not.toMatch(/\bh-4\b/);
    expect(container.firstElementChild?.className).toMatch(/aspect-video/);
  });
});

describe('UnifiedSkeleton as a span', () => {
  it('draws an inline bar that has a size of its own', () => {
    const { container } = render(<UnifiedSkeleton as="span" className="h-4 w-16" />);
    expect(container.firstElementChild?.tagName).toBe('SPAN');
    const className = container.firstElementChild?.className ?? '';
    expect(className).toMatch(/\binline-block\b/);
    expect(className).toMatch(/\bmax-w-full\b/);
    expect(className).toMatch(/\balign-middle\b/);
  });

  it('leaves a div bar without them', () => {
    const { container } = render(<UnifiedSkeleton className="h-4 w-16" />);
    expect(container.firstElementChild?.className).not.toMatch(/\b(inline-block|max-w-full|align-middle)\b/);
  });

  it("lets the caller's display, width cap and alignment replace them", () => {
    const { container } = render(<UnifiedSkeleton as="span" className="block h-4 max-w-xs align-top" />);
    const className = container.firstElementChild?.className ?? '';
    expect(className).toMatch(/\bblock\b/);
    expect(className).toMatch(/\bmax-w-xs\b/);
    expect(className).toMatch(/\balign-top\b/);
    expect(className).not.toMatch(/\b(inline-block|max-w-full|align-middle)\b/);
  });

  it('keeps the baseline for a caller that sets its own display but no alignment', () => {
    const { container } = render(<UnifiedSkeleton as="span" className="inline-block h-8 w-40 rounded-md" />);
    const className = container.firstElementChild?.className ?? '';
    expect(className).toMatch(/\binline-block\b/);
    expect(className).not.toMatch(/\balign-middle\b/);
    expect(className).not.toMatch(/\bmax-w-full\b/);
  });

  it('keeps the default under a display that only applies at a breakpoint', () => {
    const { container } = render(<UnifiedSkeleton as="span" className="h-4 w-16 md:hidden" />);
    const className = container.firstElementChild?.className ?? '';
    expect(className).toMatch(/(?:^|\s)inline-block(?:\s|$)/);
    expect(className).toMatch(/\bmd:hidden\b/);
  });

  it('keeps the default beside display-looking utilities and lets an own alignment replace its', () => {
    const { container } = render(<UnifiedSkeleton as="span" className="h-3 w-16 flex-1 align-top" />);
    const className = container.firstElementChild?.className ?? '';
    expect(className).toMatch(/\binline-block\b/);
    expect(className).toMatch(/\bmax-w-full\b/);
    expect(className).toMatch(/\balign-top\b/);
    expect(className).not.toMatch(/\balign-middle\b/);
  });
});
