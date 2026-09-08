import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionsMenu } from '../actions-menu';
import { PageActions } from '../page-actions';

const MENU_ACTIONS = [
  {
    items: [{ id: 'edit-statuses', label: 'Edit Statuses', onClick: () => {} }],
  },
];

describe('ActionsMenu header', () => {
  it('renders the header node as the first row, above every group', () => {
    render(<ActionsMenu groups={MENU_ACTIONS} header={<div data-testid="menu-header">view switcher</div>} />);
    const header = screen.getByTestId('menu-header');
    expect(header).toBeInTheDocument();
    // The header row precedes the first menu item in the document.
    const item = screen.getByText('Edit Statuses');
    expect(header.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders no header row when the node is absent', () => {
    render(<ActionsMenu groups={MENU_ACTIONS} />);
    expect(screen.queryByTestId('menu-header')).not.toBeInTheDocument();
  });
});

describe('PageActions menu-primary selector', () => {
  it('surfaces the selector inside the mobile "…" menu', () => {
    render(
      <PageActions
        variant="menu-primary"
        actions={[{ label: 'New Ticket', onClick: () => {} }]}
        menuActions={MENU_ACTIONS}
        selector={<div data-testid="view-selector">tabs</div>}
      />,
    );

    // Desktop row renders the selector inline, as before.
    expect(screen.getByTestId('view-selector')).toBeInTheDocument();

    // The mobile "…" trigger opens a menu whose header row is the selector.
    // (jsdom applies no media queries, so both breakpoint branches render —
    // the trigger is the second "More actions" button, in the mobile block.)
    const triggers = screen.getAllByLabelText('More actions');
    // Radix opens dropdown menus on pointerdown, not click.
    fireEvent.pointerDown(triggers[triggers.length - 1], { button: 0, pointerType: 'mouse' });
    expect(screen.getAllByTestId('view-selector').length).toBeGreaterThan(1);
    // The action and the menu rows coexist with their desktop twins in jsdom.
    expect(screen.getAllByText('New Ticket').length).toBeGreaterThan(1);
    expect(screen.getByText('Edit Statuses')).toBeInTheDocument();
  });
});
