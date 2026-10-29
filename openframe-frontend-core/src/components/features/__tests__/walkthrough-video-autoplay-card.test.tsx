/**
 * `autoPlayCard` on the inline walkthrough card: the card mounts its player in
 * resume mode from 0, muted and autoplaying, instead of waiting for a hover.
 */
import { render, screen, waitFor } from '@testing-library/react';
import type { Ref } from 'react';
import { useImperativeHandle, useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InlineWalkthroughVideo } from '../walkthrough-video';

interface Construction {
  role: string;
  startTime: number | undefined;
  autoPlay: boolean | undefined;
  startMuted: boolean | undefined;
}

const constructions: Construction[] = [];

vi.mock('../video', () => {
  const FakeVideo = (props: Record<string, unknown>) => {
    const role =
      props.layout === 'wide'
        ? 'theater'
        : props.firstFrameOnly
          ? 'facade'
          : props.startTime !== undefined
            ? 'resume'
            : 'preview';
    const first = useRef(true);
    if (first.current) {
      first.current = false;
      if (role !== 'facade') {
        constructions.push({
          role,
          startTime: props.startTime as number | undefined,
          autoPlay: props.autoPlay as boolean | undefined,
          startMuted: props.startMuted as boolean | undefined,
        });
      }
    }
    useImperativeHandle(
      props.playerHandleRef as Ref<unknown>,
      () => ({
        getCurrentTime: () => 0,
        getDuration: () => 600,
        getPaused: () => false,
        getMuted: () => true,
        play: () => Promise.resolve(),
        pause: () => {},
        setMuted: () => {},
      }),
      [],
    );
    return <div data-role={role} />;
  };
  return { Video: FakeVideo };
});

const FILE_VIDEO = { id: 'v1', mainVideoUrl: 'https://example.com/a.m3u8', posterUrl: null, title: 'Demo' };
const YOUTUBE_VIDEO = { id: 'v2', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', posterUrl: null, title: 'Demo' };

describe('walkthrough-video: autoPlayCard', () => {
  beforeEach(() => {
    constructions.length = 0;
  });

  // The card appears after the mount gate (an effect), so every assertion waits
  // for it: `findByRole` is what tells "not yet" apart from "never".
  it('mounts the card player in resume mode: from 0, muted, autoplaying', async () => {
    render(<InlineWalkthroughVideo video={FILE_VIDEO} autoPlayCard />);
    await waitFor(() =>
      expect(constructions).toEqual([{ role: 'resume', startTime: 0, autoPlay: true, startMuted: true }]),
    );
  });

  it('without it the card waits for a hover', async () => {
    render(<InlineWalkthroughVideo video={FILE_VIDEO} />);
    await screen.findByRole('button', { name: /Play Demo Video/ });
    expect(constructions.filter(c => c.role === 'resume')).toEqual([]);
  });

  it('a YouTube card never plays inline', async () => {
    render(<InlineWalkthroughVideo video={YOUTUBE_VIDEO} autoPlayCard />);
    await screen.findByRole('button', { name: /Play Demo Video/ });
    expect(constructions.filter(c => c.role === 'resume')).toEqual([]);
  });
});
