import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Drawer, DrawerContent, DrawerTitle } from '../drawer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../dropdown-menu';

describe('DrawerContent menus', () => {
  it('a menu opened inside a drawer renders inside the drawer, never under it on <body>', () => {
    render(
      <Drawer open>
        <DrawerContent aria-describedby={undefined}>
          <DrawerTitle>Panel</DrawerTitle>
          <DropdownMenu open>
            <DropdownMenuTrigger>Open</DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Inside</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DrawerContent>
      </Drawer>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(screen.getByText('Inside'));
  });
});
