import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataSyncLine } from '../data-attribution';

describe('DataSyncLine', () => {
  it('names the system the records are mirrored from and when it last read them', () => {
    render(<DataSyncLine sync={{ source: 'clickup', syncedAt: '2026-10-15T12:00:00Z' }} />);
    expect(screen.getByText('Data synced from ClickUp')).toBeInTheDocument();
    expect(screen.getByText(/^Last updated: /)).not.toHaveTextContent('Never');
  });

  it('shows an unknown source by its name, and a mirror that never ran as never', () => {
    render(<DataSyncLine sync={{ source: 'Linear', syncedAt: null }} />);
    expect(screen.getByText('Data synced from Linear')).toBeInTheDocument();
    expect(screen.getByText('Last updated: Never')).toBeInTheDocument();
  });

  it('draws nothing when the host states no sync, and its skeleton while loading', () => {
    const { container, rerender } = render(<DataSyncLine sync={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DataSyncLine loading />);
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByText(/Data synced from/)).not.toBeInTheDocument();
  });
});
