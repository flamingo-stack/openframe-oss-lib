/**
 * Escape on an open menu closes that menu and nothing else; the next one is the surface's. The chat's "⋯" menus (a chip's
 * and a card's, one `ActionsMenuDropdown`) sit in a panel that closes on Escape, in three shells.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActionsMenuDropdown } from '../actions-menu';
import { Drawer, DrawerContent, DrawerTitle } from '../drawer';

/** The key, where focus is: on the open menu, and once it has closed on the button it gave focus back to. */
const pressEscape = () =>
  fireEvent.keyDown(screen.queryByRole('menu') ?? screen.getByRole('button', { name: 'Record actions' }), {
    key: 'Escape',
  });

/** A chat card's or chip's menu: its host asks for no focus on the button after a pointer close. */
function Menu() {
  return (
    <ActionsMenuDropdown
      triggerAriaLabel="Record actions"
      onCloseAutoFocus={event => event.preventDefault()}
      groups={[{ items: [{ id: 'ask', label: 'Ask Mingo', onClick: () => undefined }] }]}
    />
  );
}

async function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Record actions' }), { button: 0, pointerType: 'mouse' });
  await screen.findByRole('menu');
}

/**
 * A panel whose Radix layer is another copy than the menu's, the hub's tree: its `overrides` holds `react-dialog` at 1.1.14,
 * whose layer is 1.1.10, and `react-menu` brings 1.2.1. Each copy keeps its own stack of layers, so neither knows of the
 * other: the panel's listens on the document, earlier than the menu's, and calls itself the top one. This is that listener.
 */
function PanelOfAnotherRadixCopy({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);
  return open ? <div>{children}</div> : <p>panel closed</p>;
}

describe('Escape on an open menu', () => {
  it('closes only the menu when the panel around it is another copy of Radix; the next closes the panel', async () => {
    render(
      <PanelOfAnotherRadixCopy>
        <Menu />
      </PanelOfAnotherRadixCopy>,
    );
    await openMenu();
    pressEscape();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(screen.queryByText('panel closed')).toBeNull();
    pressEscape();
    expect(screen.getByText('panel closed')).toBeTruthy();
  });

  it('closes only the menu in a drawer, and the next closes the drawer', async () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer open onOpenChange={onOpenChange}>
        <DrawerContent aria-describedby={undefined}>
          <DrawerTitle>Panel</DrawerTitle>
          <Menu />
        </DrawerContent>
      </Drawer>,
    );
    await openMenu();
    pressEscape();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
    pressEscape();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('nothing past the menu hears it, on the document or in React', async () => {
    const onDocument = vi.fn();
    const onReact = vi.fn();
    document.addEventListener('keydown', onDocument);
    render(
      <div onKeyDown={onReact}>
        <Menu />
      </div>,
    );
    await openMenu();
    pressEscape();
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onDocument).not.toHaveBeenCalled();
    expect(onReact).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onDocument);
  });

  it('gives focus back to the button, so the next Escape is heard by what holds it', async () => {
    render(<Menu />);
    await openMenu();
    pressEscape();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record actions' })).toHaveFocus());
  });

  it('a controlled menu is asked to close', async () => {
    const onOpenChange = vi.fn();
    render(
      <ActionsMenuDropdown
        open
        onOpenChange={onOpenChange}
        triggerAriaLabel="Record actions"
        groups={[{ items: [{ id: 'ask', label: 'Ask Mingo', onClick: () => undefined }] }]}
      />,
    );
    await screen.findByRole('menu');
    pressEscape();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('any other key is not its business, and a closed menu hears nothing', async () => {
    const onDocument = vi.fn();
    document.addEventListener('keydown', onDocument);
    render(<Menu />);
    pressEscape();
    expect(onDocument).toHaveBeenCalledTimes(1);
    await openMenu();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'x' });
    expect(onDocument).toHaveBeenCalledTimes(2);
    document.removeEventListener('keydown', onDocument);
  });

  it('keeps the browser from acting on the key too, as Radix does: a full-screen window stays full screen', async () => {
    render(<Menu />);
    await openMenu();
    // `fireEvent` answers false when a listener called `preventDefault`.
    expect(fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })).toBe(false);
  });
});
