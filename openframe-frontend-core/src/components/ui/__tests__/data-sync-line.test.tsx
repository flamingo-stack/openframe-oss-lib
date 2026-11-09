import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DATA_SYNC_SOURCES, type DataSyncSource } from '../../../types/data-sync';
import { StripeIcon } from '../../icons-v2-generated/brand-logos/stripe-icon';
import { PageDataSyncProvider, PageDataSyncRow } from '../../layout/page-data-sync';
import { DataSyncIcon, DataSyncLine } from '../data-attribution';

describe('DataSyncLine', () => {
  it('names the system the records are mirrored from and when it last read them', () => {
    render(<DataSyncLine sync={{ source: 'clickup', syncedAt: '2026-10-15T12:00:00Z' }} />);
    expect(screen.getByText('Data from ClickUp')).toBeInTheDocument();
    expect(screen.getByText(/^Last updated: /)).not.toHaveTextContent('Never');
  });

  it('says a mirror that never ran never synced', () => {
    render(<DataSyncLine sync={{ source: 'github', syncedAt: null }} />);
    expect(screen.getByText('Data from GitHub')).toBeInTheDocument();
    expect(screen.getByText('Last updated: Never')).toBeInTheDocument();
  });

  it.each(Object.keys(DATA_SYNC_SOURCES) as DataSyncSource[])('names and marks %s', source => {
    render(<DataSyncLine sync={{ source, syncedAt: null }} />);
    expect(screen.getByText(`Data from ${DATA_SYNC_SOURCES[source]}`)).toBeInTheDocument();
  });

  it("draws a source's mark at the size asked for", () => {
    const drawn = render(<DataSyncIcon source="stripe" size={20} />).asFragment();
    expect(drawn).toEqual(render(<StripeIcon size={20} />).asFragment());
  });

  it('draws nothing when the host states no sync, and its skeleton while loading', () => {
    const { rerender } = render(<DataSyncLine sync={null} />);
    expect(screen.queryByText(/Data from/)).not.toBeInTheDocument();
    rerender(<DataSyncLine loading />);
    // Its own words are drawn for real; the source and the date are bars, never a word of their own.
    expect(screen.getByText(/Data from/)).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    expect(screen.queryByText(/Never/)).not.toBeInTheDocument();
  });

  it('draws no line while loading when the host states no sync', () => {
    render(<DataSyncLine loading stated={false} />);
    expect(screen.queryByText(/Data from/)).not.toBeInTheDocument();
  });

  it("a page whose records are mirrored holds its row's skeleton before the list reports; one that is not draws none", () => {
    const { rerender } = render(
      <PageDataSyncProvider>
        <PageDataSyncRow />
      </PageDataSyncProvider>,
    );
    expect(screen.getByText(/Data from/)).toBeInTheDocument();
    rerender(
      <PageDataSyncProvider key="authored" stated={false}>
        <PageDataSyncRow />
      </PageDataSyncProvider>,
    );
    expect(screen.queryByText(/Data from/)).not.toBeInTheDocument();
  });
});
