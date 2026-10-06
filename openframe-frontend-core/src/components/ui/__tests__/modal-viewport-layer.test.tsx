import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentAreaWidthContext, useContentBreakpoint } from '../../../hooks/ui/use-content-breakpoint';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../dialog';
import { ModalV2 } from '../modal-v2';

function Breakpoint() {
  return <p>{useContentBreakpoint()}</p>;
}

// A modal renders where it is called, so one opened from a narrow content area
// would inherit that area's mobile tokens; the viewport layer restores the
// window's (see ods-responsive-tokens.css).
describe('ModalV2', () => {
  it('stacks on a viewport token layer', () => {
    const { baseElement } = render(
      <ModalV2 isOpen onClose={vi.fn()}>
        <p>Body</p>
      </ModalV2>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(baseElement).toContainHTML('ods-viewport-layer fixed inset-0');
  });
});

// React context crosses a portal and an inline modal alike, so the hooks would
// answer with the content area's width. The test viewport is a narrow one.
describe('content breakpoints inside window chrome', () => {
  it.each([
    [
      'ModalV2',
      <ModalV2 key="modal" isOpen onClose={vi.fn()}>
        <Breakpoint />
      </ModalV2>,
    ],
    [
      'Dialog',
      <Dialog key="dialog" open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <Breakpoint />
        </DialogContent>
      </Dialog>,
    ],
  ])('%s follows the viewport, not the content area it was opened from', (_name, overlay) => {
    render(<ContentAreaWidthContext.Provider value={1200}>{overlay}</ContentAreaWidthContext.Provider>);
    expect(screen.getByText('mobile')).toBeInTheDocument();
  });
});
