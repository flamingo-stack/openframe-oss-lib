import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageActions } from '../page-actions';

/** Open the mobile "…" menu (jsdom applies no media queries; the mobile trigger is the last "More actions"). */
function openMobileMenu() {
  const triggers = screen.getAllByLabelText('More actions');
  fireEvent.pointerDown(triggers[triggers.length - 1], { button: 0, pointerType: 'mouse' });
}

describe('PageActions: a split action collapsed into the mobile menu', () => {
  it('keeps each child its own label and gives it the parent action as secondary text', () => {
    render(
      <PageActions
        variant="icon-buttons"
        actions={[
          { label: 'Archive', variant: 'outline', onClick: () => {} },
          {
            label: 'Export',
            submenu: [
              { id: 'csv', label: 'CSV', onClick: () => {} },
              { id: 'pdf', label: 'PDF', description: 'with charts', onClick: () => {} },
            ],
          },
        ]}
      />,
    );
    openMobileMenu();
    const csv = screen.getByRole('menuitem', { name: /CSV/ });
    expect(within(csv).getByText('CSV')).toBeInTheDocument();
    expect(within(csv).getByText('Export')).toHaveClass('text-ods-text-secondary');
    // A child's own description follows the parent action.
    expect(within(screen.getByRole('menuitem', { name: /PDF/ })).getByText('Export · with charts')).toBeInTheDocument();
    expect(screen.queryByText('Export (CSV)')).not.toBeInTheDocument();
  });
});
