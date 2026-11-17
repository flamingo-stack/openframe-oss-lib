import type { Column } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTableColumnFilter } from '../data-table/data-table-column-filter';

/** A column holding `value`, with its setter spied on. */
function columnWith(value: string[] | undefined) {
  const setFilterValue = vi.fn();
  const column = { id: 'status', getFilterValue: () => value, setFilterValue } as unknown as Column<unknown, unknown>;
  return { column, setFilterValue };
}

describe('DataTableColumnFilter extra sections', () => {
  it('keeps the picks of a section that has no options on Apply, as it was not on screen to be unticked', () => {
    const { column, setFilterValue } = columnWith(['MANAGED', 'connectivity:ONLINE']);
    render(
      <DataTableColumnFilter
        column={column}
        label="Status"
        options={[{ id: 'MANAGED', label: 'MANAGED', value: 'MANAGED' }]}
        extraSections={[{ id: 'connectivity', title: 'Connectivity', options: [] }]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Filter by Status'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(setFilterValue).toHaveBeenLastCalledWith(['MANAGED', 'connectivity:ONLINE']);
  });

  it('writes a drawn section picks with its prefix', () => {
    const { column, setFilterValue } = columnWith(undefined);
    render(
      <DataTableColumnFilter
        column={column}
        label="Status"
        options={[{ id: 'MANAGED', label: 'MANAGED', value: 'MANAGED' }]}
        extraSections={[
          {
            id: 'connectivity',
            title: 'Connectivity',
            options: [{ id: 'OFFLINE', label: 'Offline', value: 'OFFLINE' }],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText('Filter by Status'));
    fireEvent.click(screen.getByRole('button', { name: /Offline/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(setFilterValue).toHaveBeenLastCalledWith(['connectivity:OFFLINE']);
  });
});
