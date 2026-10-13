/**
 * How a preview surface draws its poster: on a canvas, with no image and no
 * poster on the player. An image, the player's own poster and its loading
 * fallback's background are all Largest Contentful Paint candidates, and a
 * preview poster must never become the page's LCP.
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VideoHoverPreviewSurface } from '../video-hover-preview';

const playerPosters: unknown[] = [];

vi.mock('../video', () => ({
  Video: (props: Record<string, unknown>) => {
    playerPosters.push(props.poster);
    return <div data-testid="player" />;
  },
}));

describe('VideoHoverPreviewSurface: poster', () => {
  beforeEach(() => {
    playerPosters.length = 0;
  });

  it('draws the poster on a canvas, renders no image and hands the player no poster', () => {
    // `playerMounted` skips the near-viewport observer: the media renders at once.
    render(
      <VideoHoverPreviewSurface
        url="https://example.com/a.m3u8"
        posterUrl="https://example.com/poster.jpg"
        active={false}
        playerMounted
      />,
    );
    expect(screen.getByTestId('canvas-poster')).toBeInstanceOf(HTMLCanvasElement);
    expect(screen.queryByRole('presentation')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(playerPosters).toEqual([null]);
  });
});
