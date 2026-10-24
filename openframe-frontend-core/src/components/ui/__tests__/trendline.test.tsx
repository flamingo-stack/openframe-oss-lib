import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoadingScope } from '../loading-scope';
import { formatTrendChange, TREND_TONES, TrendHistory, Trendline, trendlinePoints, trendTone, trendToneClass } from '../trendline';

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
    fireEvent.click(screen.getByRole('button', { name: 'X: last 2 values, +1' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('with a history a keyboard can reach it; without one it is only a picture', () => {
    const { rerender } = render(<Trendline values={[1, 2]} label="X" details={() => <span>History</span>} />);
    expect(screen.getByRole('button', { name: 'X: last 2 values, +1' })).toHaveAttribute('tabindex', '0');
    rerender(<Trendline values={[1, 2]} label="X" />);
    expect(screen.getByRole('img', { name: 'X: last 2 values, +1' })).not.toHaveAttribute('tabindex');
  });
});

describe('trendlinePoints', () => {
  const inBox = (p: { x: number; y: number }) => p.x >= 0 && p.x <= 56 && p.y >= 0 && p.y <= 16;

  it('keeps negative values inside the box, lowest at the bottom', () => {
    const points = trendlinePoints([-5, 0, 5]);
    expect(points.every(inBox)).toBe(true);
    expect(points[0].y).toBeGreaterThan(points[2].y);
  });

  it('shows a small move near a large value across the whole height', () => {
    const [low, high] = trendlinePoints([1000, 1010]);
    expect(low.y - high.y).toBeGreaterThan(10);
  });

  it('draws a flat series mid-height and skips unknown values', () => {
    expect(trendlinePoints([7, 7, 7]).map((p) => p.y)).toEqual([8, 8, 8]);
    expect(trendlinePoints([1, null, 3])).toHaveLength(2);
    expect(trendlinePoints([])).toEqual([]);
  });
});

describe('trend tones', () => {
  it('names a change positive, negative or neutral, by whether a rise is good', () => {
    expect([trendTone(3), trendTone(3, true), trendTone(-1), trendTone(0), trendTone(null)]).toEqual(['negative', 'positive', 'positive', 'neutral', 'neutral']);
  });

  it('colours each tone with its ODS token, and a host may replace one', () => {
    expect(TREND_TONES).toEqual({ positive: 'text-ods-success', negative: 'text-ods-error', neutral: 'text-ods-text-secondary' });
    expect(trendToneClass(3)).toBe('text-ods-error');
    expect(trendToneClass(3, true)).toBe('text-ods-success');
    expect(trendToneClass(3, true, { positive: 'text-ods-accent' })).toBe('text-ods-accent');
    expect(trendToneClass(3, false, { positive: 'text-ods-accent' })).toBe('text-ods-error');
  });

  it('writes the change with its sign', () => {
    expect([formatTrendChange(3), formatTrendChange(-2), formatTrendChange(0)]).toEqual(['+3', '−2', '0']);
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
