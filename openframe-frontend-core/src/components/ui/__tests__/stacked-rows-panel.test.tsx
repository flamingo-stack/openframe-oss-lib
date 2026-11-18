import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StackedRowsPanel } from '../stacked-rows-panel';

describe('StackedRowsPanel', () => {
  it('truncates value and label to one line by default', () => {
    render(<StackedRowsPanel rows={[{ id: 'a', columns: [{ key: 'c', value: 'Name', label: 'Detail' }] }]} />);
    expect(screen.getByText('Name')).toHaveClass('truncate');
    expect(screen.getByText('Detail')).toHaveClass('truncate');
  });

  it('`wrap` lets the value and the label wrap instead', () => {
    render(
      <StackedRowsPanel rows={[{ id: 'a', columns: [{ key: 'c', value: 'Name', label: 'Detail', wrap: true }] }]} />,
    );
    expect(screen.getByText('Name')).toHaveClass('whitespace-normal');
    expect(screen.getByText('Name')).not.toHaveClass('truncate');
    expect(screen.getByText('Detail')).toHaveClass('whitespace-normal');
  });

  it('`previewRows` draws that many loading rows, then the loaded rows under the "Show N more" toggle', () => {
    const rows = [0, 1, 2, 3, 4].map(i => ({ id: `r${i}`, columns: [{ key: 'c', value: `Row ${i}` }] }));
    const { rerender } = render(<StackedRowsPanel rows={[]} loading previewRows={3} skeleton={{ columns: 1 }} />);
    expect(screen.queryByText('Row 0')).toBeNull();
    expect(screen.getByRole('button', { hidden: true })).toHaveAttribute('aria-expanded', 'false');

    rerender(<StackedRowsPanel rows={rows} previewRows={3} />);
    for (const row of rows) expect(screen.getByText(row.columns[0].value)).toBeInTheDocument();
    expect(screen.getByRole('button', { hidden: true })).toHaveAttribute('aria-expanded', 'false');
  });

  it('without `previewRows` the card shows every row and no toggle', () => {
    const rows = [0, 1, 2, 3, 4].map(i => ({ id: `r${i}`, columns: [{ key: 'c', value: `Row ${i}` }] }));
    render(<StackedRowsPanel rows={rows} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
