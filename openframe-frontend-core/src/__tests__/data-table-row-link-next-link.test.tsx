import { createColumnHelper } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, forwardRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';
import { registerLink } from '../embed-shims/next-link';

/**
 * A row link under a Next host. `next/link` runs the row's `onClick`, then navigates on the client unless the click
 * is already cancelled. That read comes BEFORE the row's deferred cancel (`cancelAfterReactHandlers`), so the row's
 * own `onClick` must cancel a button's click itself, or a button without `data-no-row-click` runs its action and then
 * opens the row's page. The plain `<a>` the shim draws without a host cannot show it: there the deferred cancel
 * alone stops the browser. In its own file because `registerLink` holds the host's Link for the whole module.
 */

const navigations: string[] = [];

/** `next/link`'s click as far as this matters: the caller's `onClick`, then a client navigation unless cancelled. */
const NextLikeLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }>(
  function NextLikeLinkImpl({ onClick, prefetch: _prefetch, href, ...rest }, ref) {
    return (
      <a
        ref={ref}
        href={href}
        {...rest}
        onClick={event => {
          onClick?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          navigations.push(String(href));
        }}
      />
    );
  },
);
registerLink(NextLikeLink);

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();

function Table({ layout, onAction }: { layout: 'cards' | 'grid'; onAction: () => void }) {
  const columns = [
    columnHelper.accessor('name', { id: 'name', header: 'Name' }),
    columnHelper.display({
      id: 'action',
      header: '',
      cell: () => (
        <button type="button" onClick={onAction}>
          Copy
        </button>
      ),
    }),
  ];
  const table = useDataTable({ data: [{ id: '1', name: 'Doc' }], columns });
  return (
    <DataTable table={table} layout={layout}>
      <DataTable.Body<Row> rowHref={row => `/docs/${row.id}`} />
    </DataTable>
  );
}

describe.each(['cards', 'grid'] as const)('DataTable row link under a Next host (%s layout)', layout => {
  beforeEach(() => {
    navigations.length = 0;
  });

  it('runs a button without data-no-row-click and does not open the row', () => {
    const onAction = vi.fn();
    render(<Table layout={layout} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(navigations).toEqual([]);
  });

  it('opens the row on a click in a plain cell', () => {
    render(<Table layout={layout} onAction={vi.fn()} />);
    fireEvent.click(screen.getByText('Doc'));
    expect(navigations).toEqual(['/docs/1']);
  });
});
