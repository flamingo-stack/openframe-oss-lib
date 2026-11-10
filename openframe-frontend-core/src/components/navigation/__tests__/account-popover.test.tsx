import { fireEvent, isInaccessible, render, screen, waitFor, within } from '@testing-library/react';
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
    // The design system's menu: links for places, a danger row for Log out.
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Help Center' })).toHaveAttribute('href', '/help-center');
    expect(within(screen.getByRole('menuitem', { name: 'Log out' })).getByText('Log out')).toHaveClass(
      'text-ods-error',
    );
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
    // The name stays in the row (it fades with the rail's width) but is not read.
    expect(isInaccessible(screen.getByText('acme.openframe.ai'))).toBe(true);
    expect(trigger).toHaveTextContent('AL');

    const menu = await openMenu(trigger);
    expect(menu).toHaveAttribute('data-side', 'right');
  });

  it('keeps the avatar 8px in by default, and centres it alone with collapsedAlign="center"', () => {
    const { rerender } = render(<AccountPopover collapsed name="Ada Lovelace" items={entries()} />);
    const trigger = () => screen.getByRole('button', { name: 'Account: Ada Lovelace' });
    // The name's column (the `flex-1` one) taken out of the row.
    const nameHidden = () => /class="[^"]*\bflex-1\b[^"]*\bhidden\b/.test(document.body.innerHTML);
    // Default: the name holds its place in the row (it fades with the width).
    expect(trigger()).toHaveClass('pl-[var(--spacing-system-xsf)]');
    expect(trigger()).not.toHaveClass('justify-center');
    expect(nameHidden()).toBe(false);

    rerender(<AccountPopover collapsed collapsedAlign="center" name="Ada Lovelace" items={entries()} />);
    expect(trigger()).toHaveClass('justify-center', 'gap-0', 'px-0');
    expect(nameHidden()).toBe(true);

    // Expanded, `collapsedAlign` changes nothing.
    rerender(<AccountPopover collapsedAlign="center" name="Ada Lovelace" items={entries()} />);
    expect(screen.getByRole('button', { name: /Ada Lovelace/ })).not.toHaveClass('justify-center');
    expect(nameHidden()).toBe(false);
  });

  it('is the avatar alone with avatarOnly at full width: named, its name and email in the menu header, opening upward', async () => {
    render(<AccountPopover avatarOnly name="Ada Lovelace" email="ada@example.com" items={entries()} />);
    const trigger = screen.getByRole('button', { name: 'Account: Ada Lovelace' });
    expect(trigger).toHaveAttribute('title', 'Ada Lovelace');
    // A square around the avatar, not the row's full width; the name's column taken out.
    expect(trigger).toHaveClass('size-8', 'justify-center');
    expect(trigger).not.toHaveClass('w-full');
    expect(/class="[^"]*\bflex-1\b[^"]*\bhidden\b/.test(document.body.innerHTML)).toBe(true);

    const menu = await openMenu(trigger);
    expect(menu).toHaveTextContent('Ada Lovelace');
    expect(menu).toHaveTextContent('ada@example.com');
    expect(menu).toHaveAttribute('data-side', 'top');
  });

  it("puts an item's unread count on its icon, and the unread dot on the avatar", async () => {
    const hasDot = () =>
      /class="[^"]*\bbg-ods-warning\b/.test(screen.getByRole('button', { name: /Ada Lovelace/ }).innerHTML);
    const { rerender } = render(<AccountPopover name="Ada Lovelace" items={entries()} />);
    expect(hasDot()).toBe(false);

    const withReplies: AccountPopoverEntry[] = [
      { id: 'replies', label: 'Support replies', icon: <svg />, href: '/help-center/tickets?ticket=t-1', count: 3 },
      ...entries(),
    ];
    rerender(<AccountPopover name="Ada Lovelace" items={withReplies} />);
    expect(hasDot()).toBe(true);

    await openMenu(screen.getByRole('button', { name: /Ada Lovelace/ }));
    expect(screen.getByRole('link', { name: /Support replies/ })).toHaveTextContent('3');
  });
});
