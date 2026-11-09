/**
 * VideoHoverPreviewSurface: the player, the largest script a page can load, waits for the visitor's first input. From
 * that input on it mounts near the screen, so a hover finds it with its stream loaded.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../video', () => ({
  Video: (props: { firstFrameOnly?: boolean }) => <div data-testid={props.firstFrameOnly ? 'facade' : 'player'} />,
}));
vi.mock('../../../embed-shims/next-image', () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} data-testid="poster" />,
}));

const URL = 'https://stream.mux.com/abc.m3u8';
const POSTER = 'https://image.mux.com/abc/thumbnail.jpg';

/** The first input is one-way, once per page: every test is a new page. */
async function newPage() {
  vi.resetModules();
  const { VideoHoverPreviewSurface } = await import('../video-hover-preview');
  return VideoHoverPreviewSurface;
}

describe('VideoHoverPreviewSurface', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('draws the poster and no player until the visitor does something', async () => {
    const Surface = await newPage();
    render(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted />);
    expect(screen.getByTestId('poster')).toBeTruthy();
    expect(screen.queryByTestId('player')).toBeNull();
    expect(screen.queryByTestId('facade')).toBeNull();
  });

  it('renders no player on the server', async () => {
    const Surface = await newPage();
    const html = renderToString(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted />);
    expect(html).toContain('data-testid="poster"');
    expect(html).not.toContain('data-testid="player"');
  });

  it.each([
    ['a mouse that moves', () => fireEvent.pointerMove(window)],
    ['a touch', () => fireEvent.pointerDown(window)],
    ['a key', () => fireEvent.keyDown(window, { key: 'Tab' })],
    ['a wheel', () => fireEvent.wheel(window)],
  ])('mounts the player near the screen after %s, before any hover', async (_label, act) => {
    const Surface = await newPage();
    render(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted />);
    act();
    expect(await screen.findByTestId('player')).toBeTruthy();
  });

  it('does not take an element scrolling itself for the visitor', async () => {
    const Surface = await newPage();
    render(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted />);
    fireEvent.scroll(document.body);
    expect(screen.queryByTestId('player')).toBeNull();
  });

  it('mounts at once a card drawn after the visitor acted', async () => {
    const Surface = await newPage();
    render(<div />);
    fireEvent.pointerMove(window);
    render(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted />);
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('still honours the viewport gate once the visitor acted', async () => {
    const Surface = await newPage();
    const { rerender } = render(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted />);
    fireEvent.pointerMove(window);
    expect(await screen.findByTestId('player')).toBeTruthy();
    rerender(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted={false} />);
    expect(screen.queryByTestId('player')).toBeNull();
    rerender(<Surface url={URL} posterUrl={POSTER} active={false} playerMounted />);
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('mounts for an activation with no input behind it', async () => {
    const Surface = await newPage();
    render(<Surface url={URL} posterUrl={POSTER} active playerMounted />);
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('mounts at once for a continuation, which plays with no input', async () => {
    const Surface = await newPage();
    render(<Surface url={URL} posterUrl={POSTER} active={false} continuation startTime={12} />);
    expect(screen.getByTestId('player')).toBeTruthy();
  });

  it('keeps the first-frame facade for a card with no poster', async () => {
    const Surface = await newPage();
    render(<Surface url={URL} active={false} playerMounted />);
    expect(screen.getByTestId('facade')).toBeTruthy();
    expect(screen.queryByTestId('player')).toBeNull();
  });

  it('draws a flat card and fetches nothing with preload none and no poster', async () => {
    const Surface = await newPage();
    render(<Surface url={URL} active={false} playerMounted preload="none" />);
    expect(screen.queryByTestId('facade')).toBeNull();
    expect(screen.queryByTestId('player')).toBeNull();
  });
});
