import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Popover, PopoverContent, PopoverTrigger } from '../../popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../dropdown-menu';
import { ModalV2 } from '../modal-v2';
import { CollisionBoundaryContext, useCollisionBoundary } from '../portal-container';

// A popup portaled to <body> stacks at `z-50`, under the modal's `z-[1300]`
// overlay: it opens, and nobody sees it.
describe('ModalV2 portal host', () => {
  it.each([
    [
      'DropdownMenu',
      <DropdownMenu key="menu" open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Popup</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    ],
    [
      'Popover',
      <Popover key="popover" open>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popup</PopoverContent>
      </Popover>,
    ],
  ])('portals a %s opened inside into the modal layer, outside the panel', async (_name, popup) => {
    render(
      <ModalV2 isOpen onClose={vi.fn()}>
        {popup}
      </ModalV2>,
    );

    const content = await screen.findByText('Popup');
    // Popover content is a `dialog` too: take the modal's panel from its trigger.
    const dialog = screen.getByRole('button', { name: 'Open', hidden: true }).closest('[aria-modal="true"]');
    const layer = dialog?.parentElement;
    expect(layer).toHaveClass('z-[1300]');
    expect(layer).toContainElement(content);
    expect(dialog).not.toContainElement(content);
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
