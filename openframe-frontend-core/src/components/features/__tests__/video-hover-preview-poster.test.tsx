/**
 * How a preview surface draws its poster.
 *
 * A late, uninvited surface (the floating walkthrough card) must paint nothing
 * that Largest Contentful Paint reads: no image, and no poster on the player
 * (its own poster and its loading fallback's background are candidates too).
 * The default surface keeps the plain image and the player's poster.
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

const POSTER = 'https://example.com/poster.jpg';

function renderSurface(posterPaint?: 'image' | 'canvas') {
  // `playerMounted` skips the near-viewport observer: the media renders at once.
  render(
    <VideoHoverPreviewSurface
      url="https://example.com/a.m3u8"
      posterUrl={POSTER}
      active={false}
      playerMounted
      posterPaint={posterPaint}
    />,
  );
}

describe('VideoHoverPreviewSurface: posterPaint', () => {
  beforeEach(() => {
    playerPosters.length = 0;
  });

  it('draws an image and hands the player its poster by default', () => {
    renderSurface();
    // A decorative image (`alt=""`) has the presentation role.
    expect(screen.getByRole('presentation')).toBeInstanceOf(HTMLImageElement);
    expect(screen.queryByTestId('canvas-poster')).toBeNull();
    expect(playerPosters).toEqual([POSTER]);
  });

  it('draws a canvas, no image, and hands the player no poster when asked for a canvas', () => {
    renderSurface('canvas');
    expect(screen.getByTestId('canvas-poster')).toBeInstanceOf(HTMLCanvasElement);
    expect(screen.queryByRole('presentation')).toBeNull();
    expect(playerPosters).toEqual([null]);
  });
});
