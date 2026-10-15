import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountPopover, type AccountPopoverEntry } from '../account-popover';

function entries(onLogout = vi.fn()): AccountPopoverEntry[] {
  return [
    { id: 'settings', label: 'Settings', href: '/settings' },
    { id: 'help', label: 'Help Center', href: '/help-center' },
    { type: 'divider', id: 'd1' },
    { id: 'logout', label: 'Log out', onSelect: onLogout, tone: 'danger' },
  ];
}

/** Radix opens a menu trigger on pointerdown or Enter; jsdom has no PointerEvent, so: Enter. */
async function openMenu(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu');
}

describe('AccountPopover', () => {
  it('shows the name and subtitle on the trigger, and the header and items when opened', async () => {
    render(
      <AccountPopover name="Ada Lovelace" email="ada@example.com" subtitle="acme.openframe.ai" items={entries()} />,
    );

    const trigger = screen.getByRole('button', { name: /Ada Lovelace/ });
    expect(trigger).toHaveTextContent('acme.openframe.ai');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    const menu = await openMenu(trigger);
    expect(menu).toHaveTextContent('ada@example.com');
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('menuitem', { name: 'Help Center' })).toHaveAttribute('href', '/help-center');
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toHaveClass('text-ods-error');
    expect(menu).toHaveAttribute('data-side', 'top');
  });

  it('runs an item and closes', async () => {
    const onLogout = vi.fn();
    render(<AccountPopover name="Ada" items={entries(onLogout)} />);

    await openMenu(screen.getByRole('button', { name: /Ada/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('closes on Escape', async () => {
    render(<AccountPopover name="Ada" items={entries()} />);

    const menu = await openMenu(screen.getByRole('button', { name: /Ada/ }));
    fireEvent.keyDown(menu, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('closes on an outside click', async () => {
    render(
      <>
        <button type="button">elsewhere</button>
        <AccountPopover name="Ada" items={entries()} />
      </>,
    );

    await openMenu(screen.getByRole('button', { name: /Ada/ }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }));

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('is the avatar alone when collapsed, named for screen readers, opening beside the rail', async () => {
    render(<AccountPopover collapsed name="Ada Lovelace" subtitle="acme.openframe.ai" items={entries()} />);

    const trigger = screen.getByRole('button', { name: 'Account: Ada Lovelace' });
    expect(trigger).not.toHaveTextContent('acme.openframe.ai');
    expect(trigger).toHaveTextContent('AL');

    const menu = await openMenu(trigger);
    expect(menu).toHaveAttribute('data-side', 'right');
  });
});
