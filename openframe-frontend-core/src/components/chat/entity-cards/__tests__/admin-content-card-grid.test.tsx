/**
 * `AdminContentCardGrid` — one height in every state, pinned by slot count:
 *
 *   1. loading renders `pageSize` visible skeletons and no cards;
 *   2. a short page renders its cards plus invisible slots up to `pageSize`;
 *   3. an empty list renders the empty node over a full page of invisible slots;
 *   4. a full page reserves nothing, and a custom `Skeleton` replaces the default.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminContentCardGrid } from '../admin-content-card-grid';

type Row = { id: number; name: string };
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));

const base = {
  pageSize: 6,
  itemKey: (r: Row) => r.id,
  renderCard: (r: Row) => <article>{r.name}</article>,
  empty: <p>Nothing here</p>,
};

const slotsIn = (container: HTMLElement) => container.querySelectorAll('.invisible').length;

describe('AdminContentCardGrid', () => {
  it('renders pageSize skeletons while loading', () => {
    const { container } = render(<AdminContentCardGrid {...base} items={rows(2)} loading />);
    expect(container.querySelector('[data-state="loading"]')?.children).toHaveLength(6);
    expect(screen.queryByText('Row 1')).toBeNull();
    expect(slotsIn(container)).toBe(0);
  });

  it('pads a short page with invisible slots up to pageSize', () => {
    const { container } = render(<AdminContentCardGrid {...base} items={rows(2)} loading={false} />);
    expect(screen.getByText('Row 1')).toBeTruthy();
    expect(screen.getByText('Row 2')).toBeTruthy();
    expect(slotsIn(container)).toBe(4);
  });

  it('floats the empty state over a full page of invisible slots', () => {
    const { container } = render(<AdminContentCardGrid {...base} items={[]} loading={false} />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(slotsIn(container)).toBe(6);
  });

  it('reserves nothing on a full page and uses a custom Skeleton', () => {
    const Custom = ({ className }: { className?: string }) => <div data-testid="custom" className={className} />;
    const full = render(<AdminContentCardGrid {...base} items={rows(6)} loading={false} Skeleton={Custom} />);
    expect(slotsIn(full.container)).toBe(0);
    full.unmount();
    render(<AdminContentCardGrid {...base} items={[]} loading Skeleton={Custom} />);
    expect(screen.getAllByTestId('custom')).toHaveLength(6);
  });
});
