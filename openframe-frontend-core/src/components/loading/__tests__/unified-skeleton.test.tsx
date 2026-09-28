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
