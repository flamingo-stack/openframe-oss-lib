import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalV2 } from '../modal-v2';

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
