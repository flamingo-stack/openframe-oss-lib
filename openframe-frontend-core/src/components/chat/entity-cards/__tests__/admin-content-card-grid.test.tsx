/**
 * `AdminContentCardGrid` — one height in every state, pinned by slot count:
 *
 *   1. loading renders `pageSize` visible skeletons and no cards;
 *   2. a short page renders its cards plus invisible slots up to `pageSize`;
 *   3. an empty list renders the empty node over a full page of invisible slots;
 *   4. a full page reserves nothing.
 *
 * A test `Skeleton` carries a test id, so the counts read through Testing Library.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminContentCardGrid } from '../admin-content-card-grid';

type Row = { id: number; name: string };
const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }));

const TestSkeleton = ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />;

const base = {
  pageSize: 6,
  itemKey: (r: Row) => r.id,
  renderCard: (r: Row) => <article>{r.name}</article>,
  empty: <p>Nothing here</p>,
  Skeleton: TestSkeleton,
};

const skeletons = () => screen.queryAllByTestId('skeleton');
const invisible = () => skeletons().filter((el) => el.className.includes('invisible'));

describe('AdminContentCardGrid', () => {
  it('renders pageSize visible skeletons while loading', () => {
    render(<AdminContentCardGrid {...base} items={rows(2)} loading />);
    expect(skeletons()).toHaveLength(6);
    expect(invisible()).toHaveLength(0);
    expect(screen.queryByText('Row 1')).toBeNull();
  });

  it('pads a short page with invisible slots up to pageSize', () => {
    render(<AdminContentCardGrid {...base} items={rows(2)} loading={false} />);
    expect(screen.getByText('Row 1')).toBeTruthy();
    expect(screen.getByText('Row 2')).toBeTruthy();
    expect(invisible()).toHaveLength(4);
  });

  it('floats the empty state over a full page of invisible slots', () => {
    render(<AdminContentCardGrid {...base} items={[]} loading={false} />);
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(invisible()).toHaveLength(6);
  });

  it('reserves nothing on a full page', () => {
    render(<AdminContentCardGrid {...base} items={rows(6)} loading={false} />);
    expect(screen.getByText('Row 6')).toBeTruthy();
    expect(skeletons()).toHaveLength(0);
  });
});
