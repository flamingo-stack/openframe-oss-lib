/**
 * A file video that waits for a click starts as its poster and a play button, and loads the player only when asked
 * (CU-17tkuw5xp4q); a video that plays by itself mounts its player at once.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

let lastProps: Record<string, unknown> = {};

vi.mock('@mux/mux-player-react', () => {
  const Fake = forwardRef((props: Record<string, unknown>, _ref: React.Ref<unknown>) => {
    lastProps = props;
    return <div data-testid="mux" />;
  });
  Fake.displayName = 'FakeMuxPlayer';
  return { default: Fake };
});

import { Video } from '../video';

async function playerModule(): Promise<void> {
  await act(async () => {
    await import('../video-file-player');
  });
}

describe('Video — a file video that waits for a click', () => {
  it('draws its poster and a play button, and no player', async () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" title="Release walkthrough" lazy={false} />);
    await playerModule();
    expect(screen.getByRole('button', { name: 'Play: Release walkthrough' })).toBeTruthy();
    expect(screen.queryByTestId('mux')).toBeNull();
  });

  it('mounts the player on the click and plays it with sound', async () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" lazy={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
    await playerModule();
    expect(screen.getByTestId('mux')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull();
    // The click is the gesture: the player is asked for unmuted playback (it falls back to muted on refusal).
    expect(lastProps.autoPlay).toBe('any');
  });
});

describe('Video — a file video that plays by itself', () => {
  it('mounts the player at once when it autoplays', async () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" autoPlay lazy={false} />);
    await playerModule();
    expect(screen.getByTestId('mux')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull();
  });

  it('mounts the player at once when its host drives it through a handle', async () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" playerHandleRef={() => {}} lazy={false} />);
    await playerModule();
    expect(screen.getByTestId('mux')).toBeTruthy();
  });
});
