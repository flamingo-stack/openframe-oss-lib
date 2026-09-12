import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Table } from '../table';
import type { TableColumn } from '../types';

/**
 * Two header behaviours a screen used to hand-roll per table, pinned at the
 * primitive so every table gets them:
 *
 *   · `column.hint` draws the header's definition in an InfoHint, named after
 *     the column (`About <label>`).
 *   · the label WRAPS inside its cell. A nowrapped label longer than its column
 *     does not truncate — it paints across the next column's header.
 */

interface Row {
  id: string;
  name: string;
}

const data: Row[] = [{ id: '1', name: 'Alpha' }];

// The header only draws plain columns from lg up; the global setup stubs the
// narrow branch, so this file opts into the wide one for its own cases.
const realMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe('Table column hint', () => {
  it('draws the definition beside the label, named after the column', () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Implementation owners', hint: 'Engineers building it.' },
    ];
    render(<Table data={data} columns={columns} rowKey="id" />);
    expect(screen.getByRole('button', { name: 'About Implementation owners' })).toBeTruthy();
  });

  it('draws nothing extra for a column without a hint', () => {
    const columns: TableColumn<Row>[] = [{ key: 'name', label: 'Name' }];
    render(<Table data={data} columns={columns} rowKey="id" />);
    expect(screen.queryByRole('button', { name: /^About / })).toBeNull();
  });

  it('leaves a custom renderHeader in charge of its whole contents', () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', hint: 'ignored', renderHeader: () => <span>Custom</span> },
    ];
    render(<Table data={data} columns={columns} rowKey="id" />);
    expect(screen.queryByRole('button', { name: 'About Name' })).toBeNull();
  });

  it('lets a long label wrap inside its cell instead of painting across the next one', () => {
    const columns: TableColumn<Row>[] = [{ key: 'name', label: 'Implementation owners', width: 'w-32' }];
    render(<Table data={data} columns={columns} rowKey="id" />);
    const label = screen.getAllByText('Implementation owners')[0];
    expect(label.className).not.toContain('whitespace-nowrap');
    expect(label.className).toContain('min-w-0');
    // A GOOD break: even lines, never one word stranded on its own.
    expect(label.className).toContain('text-balance');
  });

  it('pins the hint to the first line of a label that breaks onto two', () => {
    const columns: TableColumn<Row>[] = [
      { key: 'name', label: 'Implementation owners', hint: 'Engineers building it.' },
    ];
    // The assertion is about a CLASS reaching the DOM, which has no
    // accessible-name equivalent to query by — the actions-column test's shape.
    const { container } = render(<Table data={data} columns={columns} rowKey="id" />);
    expect(container.innerHTML).toContain('flex min-w-0 items-start gap-[var(--spacing-system-xxs)]');
  });
});
