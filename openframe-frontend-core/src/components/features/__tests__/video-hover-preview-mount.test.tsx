import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../video', () => ({
  Video: (props: { firstFrameOnly?: boolean }) => <div data-testid={props.firstFrameOnly ? 'first-frame' : 'player'} />,
}));

import { VideoHoverPreviewSurface } from '../video-hover-preview';

const base = {
  url: 'https://example.com/v.mp4',
  posterUrl: 'https://example.com/p.jpg',
  isClone: false,
  playerMounted: true,
};

describe('VideoHoverPreviewSurface player mount', () => {
  it('shows the poster and mounts no player while the card has not been hovered', () => {
    render(<VideoHoverPreviewSurface {...base} active={false} />);
    expect(screen.queryByTestId('player')).toBeNull();
  });

  it('mounts the player on the first hover and keeps it after', () => {
    const { rerender } = render(<VideoHoverPreviewSurface {...base} active={false} />);
    rerender(<VideoHoverPreviewSurface {...base} active />);
    expect(screen.getByTestId('player')).toBeTruthy();
    rerender(<VideoHoverPreviewSurface {...base} active={false} />);
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('mounts the player at once in continuation mode', () => {
    render(<VideoHoverPreviewSurface {...base} active={false} continuation />);
    expect(screen.getByTestId('player')).toBeTruthy();
  });
});
