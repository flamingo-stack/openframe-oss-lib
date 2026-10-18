import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataSyncLine } from '../data-attribution';

describe('DataSyncLine', () => {
  it('names the system the records are mirrored from and when it last read them', () => {
    render(<DataSyncLine sync={{ source: 'clickup', syncedAt: '2026-10-15T12:00:00Z' }} />);
    expect(screen.getByText('Data synced from ClickUp')).toBeInTheDocument();
    expect(screen.getByText(/^Last updated: /)).not.toHaveTextContent('Never');
  });

  it('says a mirror that never ran never synced', () => {
    render(<DataSyncLine sync={{ source: 'github', syncedAt: null }} />);
    expect(screen.getByText('Data synced from GitHub')).toBeInTheDocument();
    expect(screen.getByText('Last updated: Never')).toBeInTheDocument();
  });

  it('draws nothing when the host states no sync, and its skeleton while loading', () => {
    const { rerender } = render(<DataSyncLine sync={null} />);
    expect(screen.queryByText(/Data synced from/)).not.toBeInTheDocument();
    rerender(<DataSyncLine loading />);
    // Its own words are drawn for real; the source and the date are bars, never a word of their own.
    expect(screen.getByText(/Data synced from/)).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.queryByText(/Never/)).not.toBeInTheDocument();
  });

  it('draws no line while loading when the host states no sync', () => {
    render(<DataSyncLine loading stated={false} />);
    expect(screen.queryByText(/Data synced from/)).not.toBeInTheDocument();
  });
});
