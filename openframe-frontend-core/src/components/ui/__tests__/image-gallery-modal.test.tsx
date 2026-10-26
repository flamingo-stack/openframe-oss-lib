import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageGalleryModal } from '../image-gallery-modal';

const IMAGES = ['/a.png', '/b.png', '/c.png'];

describe('ImageGalleryModal', () => {
  it('loops with its arrows and the arrow keys: back from the first image is the last, next from the last is the first', () => {
    render(<ImageGalleryModal images={IMAGES} isOpen onClose={vi.fn()} />);
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Previous image'));
    expect(screen.getByText('3 / 3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Next image'));
    expect(screen.getByText('1 / 3')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByText('3 / 3')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('shows no arrows for a single image', () => {
    render(<ImageGalleryModal images={['/a.png']} isOpen onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Previous image')).toBeNull();
    expect(screen.queryByLabelText('Next image')).toBeNull();
  });
});
