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
});
