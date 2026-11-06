import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageGalleryModal } from '../image-gallery-modal';
import { Modal } from '../modal';

// The image viewer opened from a card frame (`isolate overflow-hidden`) stacked
// inside that card: the site header and the next section painted over it
// (/careers, the gathering gallery). The layer is rendered on <body> instead.
describe('Modal layer', () => {
  it('renders on <body>, outside the element it is opened from', () => {
    render(
      <div data-testid="card" className="isolate overflow-hidden" style={{ transform: 'translateY(0)' }}>
        <Modal isOpen onClose={vi.fn()}>
          <p>Inside</p>
        </Modal>
      </div>,
    );

    // Nothing is left in place: the card holds no part of the modal.
    expect(screen.getByTestId('card')).toBeEmptyDOMElement();
    expect(screen.getByText('Inside')).toBeVisible();
  });

  it('carries the image viewer out of the card it is opened from', () => {
    render(
      <div data-testid="card" className="isolate overflow-hidden">
        <ImageGalleryModal images={['/a.png', '/b.png']} isOpen onClose={vi.fn()} />
      </div>,
    );

    expect(screen.getByTestId('card')).toBeEmptyDOMElement();
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('renders nothing while closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Inside</p>
      </Modal>,
    );
    expect(screen.queryByText('Inside')).toBeNull();
  });
});
