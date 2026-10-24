import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoadingScope } from '../loading-scope';
import { formatTrendChange, TrendHistory, Trendline, trendToneClass } from '../trendline';

describe('Trendline', () => {
  it('names the number, its length and its change since the previous value', () => {
    render(<Trendline values={[4, 6, 9]} label="Unmanaged devices" />);
    expect(screen.getByRole('img', { name: 'Unmanaged devices: last 3 values, +3' })).toBeInTheDocument();
  });

  it('a host-given change wins over the computed one, and an unknown value leaves it unsaid', () => {
    const { rerender } = render(<Trendline values={[4, 6]} change={-5} label="X" />);
    expect(screen.getByRole('img', { name: 'X: last 2 values, −5' })).toBeInTheDocument();
    rerender(<Trendline values={[4, null]} label="X" />);
    expect(screen.getByRole('img', { name: 'X: last 2 values' })).toBeInTheDocument();
  });

  it('with no values keeps its box and draws nothing', () => {
    render(<Trendline values={[]} label="X" />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('in a loading scope draws its own skeleton, never the line', () => {
    render(
      <LoadingScope active>
        <Trendline values={[1, 2]} label="X" />
      </LoadingScope>,
    );
    expect(screen.queryByRole('img', { hidden: true })).toBeNull();
  });

  it('calls details only when the hover card opens, and never clicks the row it sits in', () => {
    const details = vi.fn(() => <span>History</span>);
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <Trendline values={[1, 2]} label="X" details={details} />
      </div>,
    );
    expect(details).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('img', { name: 'X: last 2 values, +1' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('formatTrendChange / trendToneClass', () => {
  it('writes the sign and colours worse red, better green, none grey', () => {
    expect([formatTrendChange(3), formatTrendChange(-2), formatTrendChange(0)]).toEqual(['+3', '−2', '0']);
    expect(trendToneClass(3)).toBe('text-ods-error');
    expect(trendToneClass(3, true)).toBe('text-ods-success');
    expect(trendToneClass(-1)).toBe('text-ods-success');
    expect(trendToneClass(0)).toBe('text-ods-text-secondary');
    expect(trendToneClass(null)).toBe('text-ods-text-secondary');
  });
});

describe('TrendHistory', () => {
  const columns = [{ label: 'Day' }, { label: 'Devices', align: 'right' as const }];

  it('draws the title, the headers and one row per value', () => {
    render(<TrendHistory title="Fleet" columns={columns} rows={[['Oct 23', '4'], ['Oct 24', '6']]} loadingRows={2} />);
    for (const text of ['Fleet', 'Day', 'Devices', 'Oct 23', '6']) expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('while loading draws skeleton cells instead of values, and the error in place of the grid', () => {
    const { rerender } = render(<TrendHistory title="Fleet" columns={columns} rows={null} loadingRows={3} />);
    expect(screen.queryByText('Oct 23')).toBeNull();
    expect(screen.getByText('Devices')).toBeInTheDocument();
    rerender(<TrendHistory title="Fleet" columns={columns} rows={null} loadingRows={3} error="Could not be read." />);
    expect(screen.getByText('Could not be read.')).toBeInTheDocument();
    expect(screen.queryByText('Devices')).toBeNull();
  });
});
