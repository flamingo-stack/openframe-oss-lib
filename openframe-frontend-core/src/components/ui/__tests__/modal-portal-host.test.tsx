import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../dropdown-menu';
import { ModalV2 } from '../modal-v2';
import { CollisionBoundaryContext, useCollisionBoundary } from '../portal-container';

// A menu portaled to <body> stacks at `z-50`, under the modal's `z-[1300]`
// overlay: it opens, and nobody sees it.
describe('ModalV2 portal host', () => {
  it('portals a menu opened inside into the modal layer, outside the panel', async () => {
    render(
      <ModalV2 isOpen onClose={vi.fn()}>
        <DropdownMenu open>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ModalV2>,
    );

    const menu = await screen.findByRole('menu');
    const layer = screen.getByRole('dialog', { hidden: true }).parentElement;
    expect(layer).toHaveClass('z-[1300]');
    expect(layer).toContainElement(menu);
    expect(screen.getByRole('dialog', { hidden: true })).not.toContainElement(menu);
  });

  it('drops a collision boundary published around it', () => {
    function Boundary() {
      return <p>{useCollisionBoundary() === null ? 'viewport' : 'surface'}</p>;
    }
    render(
      <CollisionBoundaryContext.Provider value={document.createElement('div')}>
        <ModalV2 isOpen onClose={vi.fn()}>
          <Boundary />
        </ModalV2>
      </CollisionBoundaryContext.Provider>,
    );
    expect(screen.getByText('viewport')).toBeInTheDocument();
  });
});
