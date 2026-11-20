import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../actions-menu';

const provider = (checked: boolean, footer?: string): ActionsMenuItem => ({
  id: 'openai',
  label: 'OpenAI',
  type: 'submenu',
  checked,
  footer,
  submenu: [{ id: 'gpt', label: 'GPT-5.5', type: 'radio', checked, onClick: vi.fn() }],
});

async function openSubmenu(item: ActionsMenuItem) {
  render(<ActionsMenuDropdown triggerAriaLabel="Model" groups={[{ items: [item] }]} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Model' }), { button: 0, pointerType: 'mouse' });
  const row = await screen.findByRole('menuitem', { name: 'OpenAI' });
  await waitFor(() => expect(row).toHaveFocus());
  fireEvent.keyDown(row, { key: 'ArrowRight' });
  await screen.findByRole('menuitemradio', { name: 'GPT-5.5' });
  return row;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 48));
});
afterEach(() => vi.restoreAllMocks());

describe('ActionsMenu submenu', () => {
  it('marks the row that holds the current choice', async () => {
    const row = await openSubmenu(provider(true));
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it('keeps the footer out of the scrolling rows', async () => {
    await openSubmenu(provider(false, 'Retention note'));
    const rows = screen.getByTestId('actions-menu-submenu-rows');
    expect(within(rows).getByText('GPT-5.5')).toBeInTheDocument();
    expect(within(rows).queryByText('Retention note')).not.toBeInTheDocument();
    expect(screen.getByText('Retention note')).toBeInTheDocument();
  });
});
