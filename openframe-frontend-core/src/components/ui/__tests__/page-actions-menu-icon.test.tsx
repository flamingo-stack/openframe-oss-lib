import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type PageActionButton, PageActions } from '../page-actions';

const RETINT = '[&&_svg]:!text-ods-text-secondary';

/** Open the mobile "…" menu and return the Add Script icon as its row renders it. */
function menuRowIcon(testId: string): HTMLElement {
  // jsdom applies no media queries, so the desktop buttons render too; the
  // mobile trigger is the last "More actions" button.
  const triggers = screen.getAllByLabelText('More actions');
  // Radix opens dropdown menus on pointerdown, not click.
  fireEvent.pointerDown(triggers[triggers.length - 1], { button: 0, pointerType: 'mouse' });
  return within(screen.getByRole('menuitem', { name: 'Add Script' })).getByTestId(testId);
}

function renderActions(actions: PageActionButton[]) {
  render(<PageActions variant="icon-buttons" actions={actions} />);
}

describe('PageActions mobile menu row icon', () => {
  it('re-tints an icon tinted for an accent button', () => {
    renderActions([
      { label: 'Archive', variant: 'outline', onClick: () => {} },
      {
        label: 'Add Script',
        variant: 'accent',
        onClick: () => {},
        icon: <svg data-testid="add-icon" className="text-ods-text-on-accent" />,
      },
    ]);

    expect(menuRowIcon('add-icon').parentElement).toHaveClass(RETINT);
  });

  it('treats a missing variant as the accent default', () => {
    renderActions([
      { label: 'Archive', variant: 'outline', onClick: () => {} },
      { label: 'Add Script', onClick: () => {}, icon: <svg data-testid="add-icon" /> },
    ]);

    expect(menuRowIcon('add-icon').parentElement).toHaveClass(RETINT);
  });

  it('keeps an outline button icon as the caller tinted it', () => {
    renderActions([
      { label: 'Archive', variant: 'outline', onClick: () => {} },
      {
        label: 'Add Script',
        variant: 'outline',
        onClick: () => {},
        icon: <svg data-testid="add-icon" className="text-ods-text-secondary" />,
      },
    ]);

    expect(menuRowIcon('add-icon').parentElement).not.toHaveClass(RETINT);
  });
});
