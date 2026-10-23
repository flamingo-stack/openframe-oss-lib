import { createColumnHelper } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * A row with `rowHref` IS a link, so a control inside it (an Edit button) must
 * run its own action and never follow the row's link. A control that stopped
 * propagation (or sat in a wrapper that did) kept the click from the row's
 * bubble handler, the browser followed the anchor, and Edit opened its modal
 * and then the row's page. The row guards in the capture phase.
 */

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();

function Table({
  onEdit,
  stopPropagation,
  marked = true,
}: {
  onEdit: () => void;
  stopPropagation: boolean;
  marked?: boolean;
}) {
  const columns = [
    columnHelper.accessor('name', { id: 'name', header: 'Name' }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: () => (
        <div data-no-row-click={marked ? true : undefined}>
          <div onClick={stopPropagation ? e => e.stopPropagation() : undefined}>
            <button type="button" onClick={onEdit}>
              Edit
            </button>
          </div>
          <a href="https://example.com/elsewhere">Elsewhere</a>
        </div>
      ),
    }),
  ];
  const table = useDataTable({ data: [{ id: '1', name: 'Doc' }], columns });
  return (
    <DataTable table={table}>
      <DataTable.Body<Row> rowHref={row => `/docs/${row.id}`} />
    </DataTable>
  );
}

function clickEdit() {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  fireEvent(screen.getByRole('button', { name: 'Edit' }), event);
  return event;
}

describe('DataTable row link: controls inside it', () => {
  it.each([false, true])('runs the control and does not follow the link (stopPropagation: %s)', stopPropagation => {
    const onEdit = vi.fn();
    render(<Table onEdit={onEdit} stopPropagation={stopPropagation} />);
    const event = clickEdit();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([false, true])(
    'a button without data-no-row-click does not follow the link either (stopPropagation: %s)',
    stopPropagation => {
      const onEdit = vi.fn();
      render(<Table onEdit={onEdit} stopPropagation={stopPropagation} marked={false} />);
      const event = clickEdit();
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it('leaves a link nested in a cell to follow its own address', () => {
    render(<Table onEdit={vi.fn()} stopPropagation={false} marked={false} />);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fireEvent(screen.getByRole('link', { name: 'Elsewhere' }), event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('keeps the row a link to its page', () => {
    render(<Table onEdit={vi.fn()} stopPropagation={false} />);
    expect(screen.getByRole('link', { name: /Doc/ })).toHaveAttribute('href', '/docs/1');
  });
});
