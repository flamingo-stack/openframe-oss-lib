import { createColumnHelper } from '@tanstack/react-table';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';
import { EntityImage } from '../components/ui/entity-image';

/**
 * `minRows` promises a stable table height. It kept that promise only for a
 * table whose rows are the design height — a table stating its own height got
 * pad rows and a skeleton at the design height instead, so a short page came up
 * short by the difference, per missing row.
 *
 * These lock the one thing that makes the promise true: EVERY row slot a table
 * can draw — a real row, a pad row, a skeleton row — reserves the SAME height.
 */

interface Row {
  id: string;
  name: string;
}

const columnHelper = createColumnHelper<Row>();
const columns = [columnHelper.accessor('name', { id: 'name', header: 'Name' })];

const ROW_H = 'h-[112px]';

function Table({
  data,
  loading = false,
  rowHeightClassName,
}: {
  data: Row[];
  loading?: boolean;
  rowHeightClassName?: string;
}) {
  const table = useDataTable({ data, columns });
  return (
    <DataTable table={table}>
      <DataTable.Body<Row>
        loading={loading}
        minRows={4}
        skeletonRows={4}
        autoHeight
        rowHeightClassName={rowHeightClassName}
      />
    </DataTable>
  );
}

/** The same table, but every row carries a sub-row beneath its cells. */
function TableWithSubRows({ data, rowHeightClassName }: { data: Row[]; rowHeightClassName?: string }) {
  const table = useDataTable({ data, columns });
  return (
    <DataTable table={table}>
      <DataTable.Body<Row>
        minRows={4}
        skeletonRows={4}
        rowHeightClassName={rowHeightClassName}
        renderSubRow={() => <div style={{ height: 96 }}>sub</div>}
      />
    </DataTable>
  );
}

const rows = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: String(i), name: `Row ${i}` }));

/**
 * Every explicit height utility in the rendered markup.
 *
 * Read off the markup rather than through a selector, because the height a row
 * slot reserves is exactly what ships in the class attribute — and matching an
 * arbitrary-value class through `querySelectorAll` is its own trap.
 */
function heightClasses(container: HTMLElement): string[] {
  return [...container.innerHTML.matchAll(/\b(?:md:)?(?:min-)?h-\[[^\]\s"]+\]/g)].map(m => m[0]);
}

/** The class list of every row-card slot (real or pad) in the rendered markup. */
function slotClasses(container: HTMLElement): string[] {
  return [...container.innerHTML.matchAll(/class="([^"]*\brounded-md\b[^"]*)"/g)].map(m => m[1]);
}

describe('DataTable row height', () => {
  it('reserves the SAME height for real rows and the pad rows beside them', () => {
    // Two real rows in a table promising four: two pad rows make up the rest.
    const { container } = render(<Table data={rows(2)} rowHeightClassName={ROW_H} />);
    const heights = heightClasses(container);

    expect(heights.length).toBeGreaterThan(0);
    // Not "most of them" — every single slot, or the table's height moves with
    // how many results the page happens to hold.
    expect(new Set(heights)).toEqual(new Set([ROW_H]));
  });

  it('reserves that height in the SKELETON too, so loading and loaded agree', () => {
    const { container } = render(<Table data={[]} loading rowHeightClassName={ROW_H} />);
    expect(new Set(heightClasses(container))).toEqual(new Set([ROW_H]));
  });

  it('reserves it for an EMPTY board, which is when a collapse is most visible', () => {
    const { container } = render(<Table data={[]} rowHeightClassName={ROW_H} />);
    expect(new Set(heightClasses(container))).toEqual(new Set([ROW_H]));
  });

  it('REPLACES the height rather than merging, so no md: default survives', () => {
    const { container } = render(<Table data={rows(1)} rowHeightClassName={ROW_H} />);
    const html = container.innerHTML;
    // The exact leftover that made a caller-supplied height hold on a phone and
    // lose on a desktop.
    expect(html).not.toContain('md:h-[78px]');
    expect(html).not.toContain('md:min-h-[78px]');
  });

  it('gives a pad row the same BORDER BOX as the row it stands in for', () => {
    // A real row card draws a 1px border on each side, so its outer block is
    // the inner height plus 2. A pad row without one is 2px shorter — nothing
    // per row, 54px across a 27-row remainder.
    const { container } = render(<Table data={rows(2)} rowHeightClassName={ROW_H} />);
    const slots = slotClasses(container);

    expect(slots.length).toBeGreaterThanOrEqual(4);
    expect(slots.every(cls => cls.split(/\s+/).includes('border'))).toBe(true);
  });

  it('sizes the ROW SLOT, so a sub-row does not make real rows outgrow pad rows', () => {
    // The trap: a row with a sub-row is taller than its cells. Sizing the cells
    // left every pad row short by exactly the sub-row — 96px each on a phone
    // board — which is the same jump `minRows` exists to prevent, reintroduced
    // one level down.
    const { container } = render(<TableWithSubRows data={rows(2)} rowHeightClassName={ROW_H} />);
    const slots = slotClasses(container);

    expect(slots.length).toBeGreaterThanOrEqual(4);
    // Every card — the two real rows and the two pad rows — carries the height.
    expect(slots.every(cls => cls.split(/\s+/).includes(ROW_H))).toBe(true);
    // And the cells inside a real row FILL it rather than restating it, or the
    // card would be the cells plus the sub-row.
    expect(container.innerHTML).toContain('flex-1');
  });

  it('keeps the design height when a table does not state one', () => {
    const { container } = render(<Table data={rows(1)} />);
    expect(container.innerHTML).toContain('md:h-[78px]');
  });
});

describe('EntityImage size', () => {
  it('SUBSTITUTES the default size, leaving no responsive half behind', () => {
    const { container } = render(<EntityImage src="https://example.test/a.png" alt="A" sizeClassName="size-6" />);
    const html = container.innerHTML;
    expect(html).toContain('size-6');
    // `h-4 w-6` through className used to leave this behind, which is the whole
    // bug: 16px on a phone, 60px on a desktop.
    expect(html).not.toContain('md:size-[60px]');
    expect(html).not.toContain('size-[52px]');
  });

  it('applies the same substitution to the initials fallback', () => {
    const { container } = render(<EntityImage src={null} alt="New York" sizeClassName="size-6" />);
    const html = container.innerHTML;
    expect(html).toContain('size-6');
    expect(html).not.toContain('md:size-[60px]');
  });

  it('keeps the design size when a caller does not state one', () => {
    const { container } = render(<EntityImage src={null} alt="New York" />);
    expect(container.innerHTML).toContain('md:size-[60px]');
  });
});
