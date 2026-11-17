import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppColumnHeader } from '../app-column-header';
import { useHandColumnBack } from '../index';

/**
 * The page's Back in a work-area column header (CU-17tkuw67ep4): a cell as big as the
 * close cell, flush with the column's start edge, the divider after it.
 */
describe('AppColumnHeader back', () => {
  it('draws the Back as the first cell: the close cell mirrored, flush with the start edge', () => {
    render(<AppColumnHeader title="Devices" back={{ onClick: vi.fn() }} onClose={vi.fn()} />);
    const back = screen.getByRole('button', { name: 'Back' });
    expect(screen.getAllByRole('button')[0]).toBe(back);
    // As wide as the close cell, and full height (the `cell` button stretches).
    expect(back.className).toContain('w-14');
    expect(screen.getByRole('button', { name: 'Close' }).className).toContain('w-14');
    expect(back.className).toContain('self-stretch');
    // No border and no padding at the start edge; the divider after it.
    expect(back.className).not.toContain('border-l');
    expect(back.className).toContain('border-r');
  });

  it('names the Back by its label, as accessible name and tooltip; "Back" by default', () => {
    const { rerender } = render(<AppColumnHeader title="Help Center" back={{ onClick: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Back' }).getAttribute('title')).toBe('Back');
    rerender(<AppColumnHeader title="Help Center" back={{ label: 'Back to Help Center', onClick: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Back to Help Center' }).getAttribute('title')).toBe(
      'Back to Help Center',
    );
  });

  it("runs the page's own handler", () => {
    const onClick = vi.fn();
    render(<AppColumnHeader title="Devices" back={{ onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('draws no Back without one (a section main page)', () => {
    render(<AppColumnHeader title="Devices" back={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('keeps the Back first when the host also passes leading content', () => {
    render(
      <AppColumnHeader title="Devices" back={{ onClick: vi.fn() }} leading={<button type="button">host</button>} />,
    );
    expect(
      screen.getAllByRole('button').map(button => button.getAttribute('aria-label') ?? button.textContent),
    ).toEqual(['Back', 'host']);
  });

  it('is kept and shrinks with the other cells while the column is squeezed', () => {
    render(<AppColumnHeader title="Devices" back={{ onClick: vi.fn() }} />);
    expect(screen.getByRole('button', { name: 'Back' }).className).toContain(
      'group-data-[squeezed]/work-area-page:shrink',
    );
  });

  it('exports useHandColumnBack for pages that draw their own Back', () => {
    expect(typeof useHandColumnBack).toBe('function');
  });
});
