/**
 * Host-driven autoplay on the YouTube facade: `muted` reaches the embed URL,
 * `autoActivate` may flip on after mount, and `suspended` pauses AND resumes
 * over the jsapi channel — what an accordion step needs to start its demo
 * muted when it opens and stop it when it closes.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mux/mux-player-react', () => {
  const Fake = forwardRef(() => <div data-testid="mux" />);
  Fake.displayName = 'FakeMuxPlayer';
  return { default: Fake };
});

import { Video } from '../video';

const TITLE = 'Demo';

function iframe(): HTMLIFrameElement {
  return screen.getByTitle(TITLE);
}

function commands(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls
    .map(call => call[0])
    .filter((m): m is string => typeof m === 'string' && m.includes('"command"'))
    .map(m => (JSON.parse(m) as { func: string }).func);
}

describe('Video — YouTube facade host-driven autoplay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muted lands on the embed as mute=1; the default stays unmuted', () => {
    const { unmount } = render(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate muted />);
    expect(iframe().src).toContain('autoplay=1');
    expect(iframe().src).toContain('mute=1');
    unmount();

    render(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate />);
    expect(iframe().src).not.toContain('mute=');
  });

  it('autoActivate flipping on after mount activates the embed', () => {
    const { rerender } = render(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate={false} />);
    expect(screen.getByRole('button', { name: `Play: ${TITLE}` })).toBeInTheDocument();
    expect(screen.queryByTitle(TITLE)).toBeNull();

    rerender(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate />);
    expect(iframe()).toBeInTheDocument();

    // Flipping it back off is not a teardown — `suspended` is the pause signal.
    rerender(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate={false} />);
    expect(iframe()).toBeInTheDocument();
  });

  it('suspended pauses on the way up and resumes on the way down', () => {
    const { rerender } = render(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate />);
    const post = vi.spyOn(iframe().contentWindow as Window, 'postMessage');

    rerender(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate suspended />);
    expect(commands(post)).toEqual(['pauseVideo']);

    rerender(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate suspended={false} />);
    expect(commands(post)).toEqual(['pauseVideo', 'playVideo']);

    // Steady state posts nothing.
    rerender(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} autoActivate suspended={false} />);
    expect(commands(post)).toEqual(['pauseVideo', 'playVideo']);
  });
});

describe('Video — YouTube facade poster, caption and onPlay', () => {
  it("draws the page's own poster and caption, and reports the poster's Play only", () => {
    const onPlay = vi.fn();
    render(
      <Video
        kind="youtube"
        url="dQw4w9WgXcQ"
        title={TITLE}
        poster="/cover.jpg"
        caption={{ title: 'Line one\nLine two', meta: 'Conrad · 0:45' }}
        onPlay={onPlay}
        lazy={false}
      />,
    );
    const play = screen.getByRole('button', { name: `Play: ${TITLE}` });
    expect(screen.getByAltText(TITLE).getAttribute('src')).toContain('/cover.jpg');
    expect(screen.getByAltText(TITLE).getAttribute('src')).not.toContain('ytimg');
    expect(screen.getByText('Conrad · 0:45')).toBeInTheDocument();
    expect(onPlay).not.toHaveBeenCalled();

    fireEvent.click(play);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(iframe()).toBeInTheDocument();
  });

  it("keeps YouTube's thumbnail without a poster, and autoActivate is not a reported play", () => {
    const onPlay = vi.fn();
    render(<Video kind="youtube" url="dQw4w9WgXcQ" title={TITLE} lazy={false} />);
    expect(screen.getByAltText(TITLE).getAttribute('src')).toContain('i.ytimg.com/vi/dQw4w9WgXcQ');

    render(<Video kind="youtube" url="dQw4w9WgXcQ" title="Auto" autoActivate onPlay={onPlay} />);
    expect(onPlay).not.toHaveBeenCalled();
  });
});
