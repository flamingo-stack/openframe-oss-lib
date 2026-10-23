import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModalV2 } from '../modal-v2';

// A modal opened from a sticky header or a bottom action bar (a transform or a
// backdrop filter) was clipped to that bar: its fixed layer took the bar as its
// containing block. The layer is rendered on <body> instead.
describe('ModalV2 layer', () => {
  it('renders on <body>, outside the element it is opened from', () => {
    render(
      <div data-testid="bar" style={{ transform: 'translateY(0)' }}>
        <ModalV2 isOpen onClose={vi.fn()}>
          <p>Inside</p>
        </ModalV2>
      </div>,
    );

    // Nothing is left in place: the bar holds no part of the modal.
    expect(screen.getByTestId('bar')).toBeEmptyDOMElement();
    expect(screen.getByText('Inside')).toBeVisible();
  });

  it('renders nothing while closed', () => {
    render(
      <ModalV2 isOpen={false} onClose={vi.fn()}>
        <p>Inside</p>
      </ModalV2>,
    );
    expect(screen.queryByText('Inside')).toBeNull();
  });
});
