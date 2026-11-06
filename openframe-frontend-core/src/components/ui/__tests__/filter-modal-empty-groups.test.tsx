import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterModal, type FilterGroup } from '../filter-modal';

function renderModal(filterGroups: FilterGroup[]) {
  return render(
    <FilterModal
      isOpen
      onClose={vi.fn()}
      title="Filter by Tags"
      filterGroups={filterGroups}
      onFilterChange={vi.fn()}
      emptyStateTitle="No tags to filter by"
      emptyStateDescription="Nothing here has tags."
    />,
  );
}

// A group with no options is not drawn, so it must not count as content either:
// a modal whose groups are all empty showed a blank body between the title and
// Reset / Apply, which read as a failed load.
describe('FilterModal with empty groups', () => {
  it('draws the empty state when every group has no options', () => {
    renderModal([
      { id: 'tags', title: 'Tags', options: [] },
      { id: 'status', title: 'Status', options: [] },
    ]);
    expect(screen.getByText('No tags to filter by')).toBeInTheDocument();
    expect(screen.getByText('Nothing here has tags.')).toBeInTheDocument();
  });

  it('draws the groups that have options, and not the empty state', () => {
    renderModal([
      { id: 'tags', title: 'Tags', options: [{ id: 'tag-1', label: 'backup' }] },
      { id: 'status', title: 'Status', options: [] },
    ]);
    expect(screen.getByText('backup')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
    expect(screen.queryByText('No tags to filter by')).not.toBeInTheDocument();
  });
});
