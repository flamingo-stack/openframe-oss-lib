/**
 * `TabSelector size="small"`: a fixed 32px row with h6 labels and 16px icons,
 * for a narrow column (the sidebar's chat history). The default stays 44 / 48px.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabSelector, type TabSelectorItem } from '../tab-selector';

const ITEMS: TabSelectorItem[] = [
  { id: 'my', label: 'My Chats', icon: <svg /> },
  { id: 'all', label: 'All Chats' },
];

/** The row is a role-less box: read its classes off the markup. */
function rowClasses(container: HTMLElement) {
  return /<div class="(flex gap-[^"]*)"><button/.exec(container.innerHTML)?.[1].split(' ') ?? [];
}

describe('TabSelector size', () => {
  it('small: a 32px row that does not grow, h6 labels, 16px icons', () => {
    const onValueChange = vi.fn();
    const { container } = render(<TabSelector size="small" value="my" onValueChange={onValueChange} items={ITEMS} />);
    expect(rowClasses(container)).toEqual(expect.arrayContaining(['h-8', 'rounded-md', 'border']));
    expect(rowClasses(container)).not.toContain('h-11');
    expect(rowClasses(container)).not.toContain('content-md:h-12');
    const my = screen.getByRole('button', { name: 'My Chats' });
    expect(my).toHaveClass('text-h6', 'py-0');
    expect(my).not.toHaveClass('text-h4');
    expect(my.innerHTML).toMatch(/^<span class="flex size-4 shrink-0 items-center justify-center">/);
    fireEvent.click(screen.getByRole('button', { name: 'All Chats' }));
    expect(onValueChange).toHaveBeenCalledWith('all');
  });

  it('default: unchanged 44px row, 48px from content-md, h4 labels', () => {
    const { container } = render(<TabSelector value="my" onValueChange={vi.fn()} items={ITEMS} />);
    expect(rowClasses(container)).toEqual(expect.arrayContaining(['h-11', 'content-md:h-12']));
    const my = screen.getByRole('button', { name: 'My Chats' });
    expect(my).toHaveClass('text-h4', 'p-[var(--spacing-system-xsf)]');
    expect(my.innerHTML).toMatch(/content-md:size-6/);
  });
});
