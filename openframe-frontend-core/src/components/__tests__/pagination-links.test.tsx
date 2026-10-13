import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { registerNavigation } from '../../embed-shims/next-navigation';
import { Pagination } from '../pagination';
import { UnifiedPagination } from '../unified-pagination';

const href = (page: number) => (page <= 1 ? '/blog' : `/blog?page=${page}`);

describe('Pagination without page addresses (the behaviour every caller had)', () => {
  it('draws buttons only and changes the page on click', () => {
    const onPageChange = vi.fn<(page: number) => void>();
    render(<Pagination currentPage={2} totalPages={9} onPageChange={onPageChange} />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Go to previous page' }));
    expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([3, 3, 1]);
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe('page');
  });

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toHaveProperty('disabled', true);
    rerender(<Pagination currentPage={3} totalPages={3} onPageChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Go to next page' })).toHaveProperty('disabled', true);
  });
});

describe('Pagination with page addresses', () => {
  it('draws every enabled control as a link to its page, with the same names', () => {
    render(<Pagination currentPage={3} totalPages={9} onPageChange={() => {}} getPageHref={href} />);

    const links: Record<string, string | null> = {};
    for (const link of screen.getAllByRole('link')) {
      links[link.getAttribute('aria-label') ?? ''] = link.getAttribute('href');
    }
    expect(links).toEqual({
      'Go to previous page': '/blog?page=2',
      'Page 1': '/blog',
      'Page 2': '/blog?page=2',
      'Page 3': '/blog?page=3',
      'Page 4': '/blog?page=4',
      'Page 9': '/blog?page=9',
      'Go to next page': '/blog?page=4',
    });
    expect(screen.getByRole('link', { name: 'Page 3' }).getAttribute('aria-current')).toBe('page');
  });

  it('changes the page in place on a plain click and does not navigate', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={9} onPageChange={onPageChange} getPageHref={href} />);

    const notPrevented = fireEvent.click(screen.getByRole('link', { name: 'Page 4' }));
    expect(notPrevented).toBe(false); // default prevented: the browser does not follow the link
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('leaves a new-tab click to the browser', () => {
    const onPageChange = vi.fn();
    render(<Pagination currentPage={3} totalPages={9} onPageChange={onPageChange} getPageHref={href} />);

    for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      expect(fireEvent.click(screen.getByRole('link', { name: 'Page 4' }), modifier)).toBe(true);
    }
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('keeps a disabled control a disabled button, never a link to a page that does not exist', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} getPageHref={href} />);
    expect(screen.getByRole('button', { name: 'Go to previous page' })).toHaveProperty('disabled', true);
    expect(screen.queryByRole('link', { name: 'Go to previous page' })).toBeNull();
  });

  it('keeps the classes of the button it replaces', () => {
    const { unmount } = render(<Pagination currentPage={3} totalPages={9} onPageChange={() => {}} />);
    const asButton = screen.getByRole('button', { name: 'Page 4' }).className;
    const current = screen.getByRole('button', { name: 'Page 3' }).className;
    unmount();
    render(<Pagination currentPage={3} totalPages={9} onPageChange={() => {}} getPageHref={href} />);
    expect(screen.getByRole('link', { name: 'Page 4' }).className).toBe(asButton);
    expect(screen.getByRole('link', { name: 'Page 3' }).className).toBe(current);
  });
});

describe('UnifiedPagination', () => {
  it('links pages while it owns ?page=, and updates the URL without a navigation', () => {
    // The list is at /blog?tags=guide (the test setup registers the router; this names its URL).
    registerNavigation({ usePathname: () => '/blog', useSearchParams: () => new URLSearchParams('tags=guide') });
    const onPageChange = vi.fn();
    const replaceState = vi.spyOn(window.history, 'replaceState');
    render(<UnifiedPagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);

    expect(screen.getByRole('link', { name: 'Page 2' }).getAttribute('href')).toBe('/blog?tags=guide&page=2');
    expect(screen.getByRole('link', { name: 'Page 1' }).getAttribute('href')).toBe('/blog?tags=guide');

    expect(fireEvent.click(screen.getByRole('link', { name: 'Page 2' }))).toBe(false);
    expect(onPageChange).toHaveBeenCalledWith(2);
    // The address bar is rewritten in place, exactly as before the controls were links.
    expect(replaceState).toHaveBeenCalledWith(null, '', '/blog?tags=guide&page=2');
    replaceState.mockRestore();
  });

  it('keeps buttons when the caller owns the URL', () => {
    render(<UnifiedPagination currentPage={1} totalPages={5} onPageChange={() => {}} syncUrl={false} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeTruthy();
  });

  it('renders nothing for a single page, as before', () => {
    const { container } = render(<UnifiedPagination currentPage={1} totalPages={1} />);
    expect(container.innerHTML).toBe('');
  });
});
