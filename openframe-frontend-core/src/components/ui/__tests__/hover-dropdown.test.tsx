import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoverDropdown } from '../hover-dropdown';

const items = [
  { label: 'The Last 10% of Patching', href: '/blog/last-10' },
  { label: 'What Is WSUS?', href: '/blog/wsus' },
];

describe('HoverDropdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // Inside the chat's message list a `fixed` panel stayed in the list's stacking context, under the composer.
  it('draws its panel on the page body, outside the trigger', () => {
    render(
      <div data-testid="list">
        <HoverDropdown items={items}>
          <span>Blog Posts (2 records)</span>
        </HoverDropdown>
      </div>,
    );
    fireEvent.mouseEnter(screen.getByText('Blog Posts (2 records)'));
    const row = screen.getByText('What Is WSUS?');
    expect(screen.getByTestId('list')).not.toContainElement(row);
    expect(document.body).toContainElement(row);
  });

  it('stays open while the pointer is on the panel, and closes after it leaves', () => {
    render(
      <HoverDropdown items={items} hideDelay={200}>
        <span>Blog Posts (2 records)</span>
      </HoverDropdown>,
    );
    fireEvent.mouseEnter(screen.getByText('Blog Posts (2 records)'));
    fireEvent.mouseLeave(screen.getByText('Blog Posts (2 records)'));
    // Entering a row enters the panel that holds it (React computes enter and leave for every ancestor).
    const row = screen.getByText('What Is WSUS?');
    fireEvent.mouseEnter(row);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('What Is WSUS?')).toBeInTheDocument();

    fireEvent.mouseLeave(row);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText('What Is WSUS?')).toBeNull();
  });
});
