/**
 * `AppLayout` `mobileMenuOpen` / `onMobileMenuOpenChange`: the host can open and
 * close the phone burger menu itself, and hears every open / close the layout
 * asks for — including the navigations that close it.
 *
 * jsdom answers every media query `false`: the phone layout, burger included.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NavigationSidebarConfig } from '../../../types/navigation';
import { AppLayout, type AppLayoutProps } from '../app-layout';
import { AppLayoutDrawer, AppLayoutDrawerContent, AppLayoutDrawerTitle } from '../app-layout-drawer';

const icon = <svg />;

function config(currentPath?: string): NavigationSidebarConfig {
  return {
    variant: 'grouped',
    currentPath,
    onNavigate: () => undefined,
    items: [
      { id: 'devices', label: 'Devices', icon, path: '/devices' },
      { id: 'tickets', label: 'Tickets', icon, path: '/tickets' },
    ],
  };
}

type MenuProps = Pick<AppLayoutProps, 'mobileMenuOpen' | 'onMobileMenuOpenChange' | 'drawer'> & {
  currentPath?: string;
};

function layout({ currentPath, ...props }: MenuProps) {
  return (
    <AppLayout sidebarConfig={config(currentPath)} headerProps={{}} mobileBurgerMenuProps={{}} {...props}>
      <h1>Page</h1>
    </AppLayout>
  );
}

const menuIsOpen = () => screen.getByRole('button', { name: /menu$/ }).getAttribute('aria-expanded') === 'true';

afterEach(() => vi.restoreAllMocks());

describe('AppLayout controlled mobile menu', () => {
  it('follows the host: open and closed without a click', () => {
    const { rerender } = render(layout({ mobileMenuOpen: true, onMobileMenuOpenChange: vi.fn() }));
    expect(menuIsOpen()).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Mobile navigation menu' })).not.toHaveAttribute('inert');

    rerender(layout({ mobileMenuOpen: false, onMobileMenuOpenChange: vi.fn() }));
    expect(menuIsOpen()).toBe(false);
  });

  it('asks the host from the burger toggle and stays as the host says', () => {
    const onChange = vi.fn();
    render(layout({ mobileMenuOpen: false, onMobileMenuOpenChange: onChange }));
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    // The host did not apply it.
    expect(menuIsOpen()).toBe(false);
  });

  it('asks to close when a nav entry in the menu is clicked', () => {
    const onChange = vi.fn();
    render(layout({ mobileMenuOpen: true, onMobileMenuOpenChange: onChange }));
    const menu = screen.getByRole('dialog', { name: 'Mobile navigation menu' });
    fireEvent.click(within(menu).getByRole('link', { name: 'Tickets' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('asks to close when the location changes while open — a navigation from a slot included', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      layout({ mobileMenuOpen: true, onMobileMenuOpenChange: onChange, currentPath: '/mingo/chat?id=1' }),
    );
    expect(onChange).not.toHaveBeenCalled();
    rerender(layout({ mobileMenuOpen: true, onMobileMenuOpenChange: onChange, currentPath: '/mingo/chat?id=2' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('says nothing for a location change while closed', () => {
    const onChange = vi.fn();
    const { rerender } = render(layout({ mobileMenuOpen: false, onMobileMenuOpenChange: onChange, currentPath: '/a' }));
    rerender(layout({ mobileMenuOpen: false, onMobileMenuOpenChange: onChange, currentPath: '/b' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes an open in-layout drawer when the host opens the menu', () => {
    const onDrawerOpenChange = vi.fn();
    const drawer = (
      <AppLayoutDrawer open onOpenChange={onDrawerOpenChange}>
        <AppLayoutDrawerContent>
          <AppLayoutDrawerTitle>Details</AppLayoutDrawerTitle>
        </AppLayoutDrawerContent>
      </AppLayoutDrawer>
    );
    const { rerender } = render(layout({ mobileMenuOpen: false, onMobileMenuOpenChange: vi.fn(), drawer }));
    expect(onDrawerOpenChange).not.toHaveBeenCalled();
    rerender(layout({ mobileMenuOpen: true, onMobileMenuOpenChange: vi.fn(), drawer }));
    expect(onDrawerOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('AppLayout uncontrolled mobile menu', () => {
  it('keeps its own state, and still reports it', () => {
    const onChange = vi.fn();
    render(layout({ onMobileMenuOpenChange: onChange }));
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(menuIsOpen()).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(menuIsOpen()).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('closes itself when the location changes', () => {
    const { rerender } = render(layout({ currentPath: '/devices' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(menuIsOpen()).toBe(true);
    rerender(layout({ currentPath: '/tickets' }));
    expect(menuIsOpen()).toBe(false);
  });

  it('stays open across re-renders without a location (as before)', () => {
    const { rerender } = render(layout({}));
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    rerender(layout({}));
    expect(menuIsOpen()).toBe(true);
  });
});
