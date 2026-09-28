import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Table } from '../table';
import type { TableColumn } from '../types';

/**
 * `actionsColumnWidth` exists because the DEFAULT actions column is
 * content-sized, and a content-sized column sizes independently in the header
 * and in the rows — so wide text actions push every other column out of
 * alignment against the header's "Showing N results" counter. The failure it
 * prevents is purely visual, which is exactly the kind no other test catches.
 *
 * Pinned here because the prop is a pass-through with three hops (Table ->
 * injectSyntheticColumns -> the synthetic column's `width`), and a dropped hop
 * still type-checks and still renders.
 */

interface Row {
  id: string;
  name: string;
}

const data: Row[] = [{ id: '1', name: 'Alpha' }];
const columns: TableColumn<Row>[] = [{ key: 'name', label: 'Name' }];
const rowActions = [{ label: 'Do the long thing', onClick: () => {} }];

/** The rendered markup as text: the assertion is about a CLASS reaching the
 *  DOM, which has no accessible-name equivalent to query by. */
const classesOf = (c: HTMLElement) => c.innerHTML;

describe('Table actionsColumnWidth', () => {
  it('applies a caller-fixed width to the synthetic actions column', () => {
    const { container } = render(
      <Table data={data} columns={columns} rowKey="id" rowActions={rowActions} actionsColumnWidth="w-60" />,
    );
    expect(classesOf(container)).toContain('w-60');
  });

  it('falls back to the content-sized default when the caller says nothing', () => {
    const { container } = render(<Table data={data} columns={columns} rowKey="id" rowActions={rowActions} />);
    const classes = classesOf(container);
    expect(classes).toContain('min-w-[100px]');
    expect(classes).not.toContain('w-60');
  });

  it('injects no actions column at all without row actions', () => {
    const { container } = render(<Table data={data} columns={columns} rowKey="id" />);
    expect(classesOf(container)).not.toContain('min-w-[100px]');
  });
});
