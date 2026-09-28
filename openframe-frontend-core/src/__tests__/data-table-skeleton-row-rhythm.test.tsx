import { createColumnHelper } from '@tanstack/react-table';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * A skeleton row stands in for a real row, so it has to occupy the same slot:
 * same container, same gap, same consumer row classes. Two places broke that.
 *
 * - The loading body dropped `rowClassName`. Tables put their row spacing
 *   there (`mb-1`), so a loading table stacked 4px tighter per row than the
 *   loaded one and every row below the first moved when the data arrived.
 * - The infinite footer drew its load-more skeleton as a bare child of the
 *   table root: no gap container, no row classes. The placeholder rows touched
 *   each other and the page shifted when the next page replaced them.
 *
 * `data-table-row-height.test.tsx` locks the HEIGHT of every slot; this locks
 * where the slots stack and what spaces them.
 */

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();
const columns = [columnHelper.accessor('name', { id: 'name', header: 'Name' })];

const ROW_SPACING = 'mb-1';
const ROW_H = 'h-[112px]';

const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}` }));
const noop = () => undefined;

function Table({
  data,
  loading = false,
  isFetchingNextPage = false,
  rowClassName = ROW_SPACING,
  minRows,
}: {
  data: Row[];
  loading?: boolean;
  isFetchingNextPage?: boolean;
  rowClassName?: string | ((item: Row) => string);
  minRows?: number;
}) {
  const table = useDataTable({ data, columns });
  return (
    <DataTable table={table}>
      <DataTable.Body<Row>
        loading={loading}
        skeletonRows={3}
        minRows={minRows}
        rowClassName={rowClassName}
        rowHeightClassName={ROW_H}
      />
      <DataTable.InfiniteFooter
        // No next page, so the sentinel (and jsdom's missing IntersectionObserver) stays out of it.
        hasNextPage={false}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={noop}
        skeletonRows={2}
      />
    </DataTable>
  );
}

type SlotKind = 'row' | 'skeleton' | 'pad';

/**
 * Every row-card slot in the rendered markup, in document order.
 *
 * Read off the markup, as `data-table-row-height.test.tsx` does: what spaces a
 * slot is exactly what ships in its class attribute.
 */
function slots(container: HTMLElement): { kind: SlotKind; classes: string[] }[] {
  return [...container.innerHTML.matchAll(/class="([^"]*\brounded-md\b[^"]*)"/g)].map(match => {
    const classes = (match[1] ?? '').split(/\s+/);
    const kind: SlotKind = classes.includes('animate-pulse')
      ? 'skeleton'
      : classes.includes('border-transparent')
        ? 'pad'
        : 'row';
    return { kind, classes };
  });
}

const skeletonSlots = (container: HTMLElement) => slots(container).filter(slot => slot.kind === 'skeleton');

/** How many row stacks (the body's gap container, or the footer's fallback one) the markup holds. */
const stackCount = (container: HTMLElement) => container.innerHTML.split('gap-[var(--spacing-system-xsf)]').length - 1;

describe('DataTable skeleton row rhythm', () => {
  it('spaces the LOADING skeleton with the same rowClassName as the rows it stands in for', () => {
    const { container } = render(<Table data={[]} loading />);
    const skeleton = skeletonSlots(container);

    expect(skeleton).toHaveLength(3);
    expect(skeleton.every(slot => slot.classes.includes(ROW_SPACING))).toBe(true);
  });

  it('gives load-more skeleton rows the row spacing AND the row height', () => {
    const { container } = render(<Table data={rows(2)} isFetchingNextPage />);
    const skeleton = skeletonSlots(container);

    expect(skeleton).toHaveLength(2);
    expect(skeleton.every(slot => slot.classes.includes(ROW_SPACING) && slot.classes.includes(ROW_H))).toBe(true);
  });

  it('draws the load-more skeleton INSIDE the body, continuing its rows', () => {
    // Pad rows are the body's last children, so placeholders that come BEFORE
    // them sit in the body's own container — under its gap — and not beside it
    // under the table root, where they used to stack with no gap at all.
    const { container } = render(<Table data={rows(2)} isFetchingNextPage minRows={6} />);

    expect(slots(container).map(slot => slot.kind)).toEqual(['row', 'row', 'skeleton', 'skeleton', 'pad', 'pad']);
    // One stack: the body's. The footer added none of its own.
    expect(stackCount(container)).toBe(1);
  });

  it('removes them when the page has arrived', () => {
    const { container, rerender } = render(<Table data={rows(2)} isFetchingNextPage />);
    expect(skeletonSlots(container)).toHaveLength(2);

    rerender(<Table data={rows(4)} />);
    expect(slots(container).map(slot => slot.kind)).toEqual(['row', 'row', 'row', 'row']);
  });

  it('skips a FUNCTION rowClassName — there is no item to call it with', () => {
    const { container } = render(<Table data={rows(2)} isFetchingNextPage rowClassName={() => 'from-fn'} />);
    const skeleton = skeletonSlots(container);

    expect(skeleton).toHaveLength(2);
    expect(skeleton.some(slot => slot.classes.includes('from-fn'))).toBe(false);
  });

  it('still stacks a skeleton when the body has no rows to continue', () => {
    // An empty body does not take the rows over, so the footer draws its own —
    // in a stack of its own rather than bare under the table root.
    const { container } = render(<Table data={[]} isFetchingNextPage />);

    expect(skeletonSlots(container)).toHaveLength(2);
    expect(stackCount(container)).toBe(2);
  });
});
