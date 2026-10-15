import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClockHistoryIcon, SearchIcon } from '../../icons-v2-generated';
import { AppHeader, type AppHeaderCell } from '../app-header';

const history = vi.fn();

const CELLS: AppHeaderCell[] = [
  {
    id: 'history',
    icon: <ClockHistoryIcon className="h-6 w-6" />,
    label: 'Chat history',
    onClick: history,
    mobileOnly: true,
  },
  { id: 'find', icon: <SearchIcon className="h-6 w-6" />, label: 'Find', placement: 'end' },
];

function cellNames() {
  return within(screen.getByRole('banner'))
    .getAllByRole('button')
    .map(button => button.getAttribute('aria-label'));
}

describe('AppHeader customCells', () => {
  it('places the cells around the built-in ones, in the phone top bar', () => {
    render(
      <AppHeader
        isMobileMenuOpen={false}
        showNotifications
        showMingoAI
        onMingoAI={() => undefined}
        customCells={CELLS}
      />,
    );
    // jsdom answers every media query `false`: the phone layout.
    expect(cellNames()).toEqual(['Open menu', 'Chat history', 'Notifications', 'Find', 'Mingo AI']);
  });

  it('draws them as the built-in cells: divider, mobile-only in CSS, clickable', () => {
    render(<AppHeader isMobileMenuOpen={false} customCells={CELLS} />);
    const cell = screen.getByRole('button', { name: 'Chat history' });
    expect(cell).toHaveClass('border-l', 'border-ods-border', 'md:hidden');
    expect(cell).toHaveAttribute('type', 'button');
    fireEvent.click(cell);
    expect(history).toHaveBeenCalledTimes(1);
    // No action, no click.
    expect(screen.getByRole('button', { name: 'Find' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Find' })).not.toHaveClass('md:hidden');
  });

  it('dims and disables them with the header', () => {
    render(<AppHeader isMobileMenuOpen={false} customCells={CELLS} disabled />);
    const cell = screen.getByRole('button', { name: 'Chat history' });
    expect(cell).toBeDisabled();
    expect(cell).toHaveClass('opacity-50');
  });

  it('reserves their footprints while loading', () => {
    render(<AppHeader isMobileMenuOpen={false} loading showNotifications showMingoAI customCells={CELLS} />);
    // The placeholder cells are role-less boxes; the trailing ones are those
    // with a leading divider. In live order: the mobile-only start cell, the
    // bell, the end cell, the wide Mingo cell.
    const trailing = Array.from(
      screen.getByRole('banner').innerHTML.matchAll(/<div class="([^"]*\bborder-l\b[^"]*)">/g),
      match => match[1],
    );
    expect(trailing).toHaveLength(4);
    expect(trailing.map(classes => /(^| )md:hidden( |$)/.test(classes))).toEqual([true, false, false, false]);
    expect(trailing[3]).toContain('md:w-[140px]');
  });

  it('leaves the header unchanged without them', () => {
    render(<AppHeader isMobileMenuOpen={false} showNotifications />);
    expect(cellNames()).toEqual(['Open menu', 'Notifications']);
  });
});
