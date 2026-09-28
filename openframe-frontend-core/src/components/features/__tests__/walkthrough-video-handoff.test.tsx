/**
 * Behavioural pin for the theater <-> mini-player handoff in
 * `InlineWalkthroughVideo`, which had no test coverage at all before this.
 *
 * These four scenarios exist because the handoff's timing is load-bearing and
 * invisible: on the rising edge the seed must read the LIVE mini player, which
 * is destroyed in that same commit. Scenario B is the one that distinguishes a
 * correct implementation from the obvious-looking wrong one — an all-in-a-
 * layout-effect version passes A, C and D and fails B with `expected 42 to be
 * 60`, because by then the ref has been nulled and only the stale stored
 * handoff is left. If B ever starts failing, the seed has drifted out of
 * render; see the `render-phase-media-handoff` block in eslint.config.mjs.
 */
import { render, act, waitFor, screen } from '@testing-library/react';
import type { Ref } from 'react';
import { useImperativeHandle, useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InlineWalkthroughVideo } from '../walkthrough-video';

interface FakeState {
  time: number;
  muted: boolean;
  paused: boolean;
  duration: number;
}

interface Construction {
  role: string;
  startTime: number | undefined;
  autoPlay: boolean | undefined;
  autoPlayUnmuted: boolean | undefined;
  startMuted: boolean | undefined;
}

const constructions: Construction[] = [];
/** Live element state, addressed by the role the props identify. */
const states = new Map<string, FakeState>();
let mutedFallbackCb: ((s: { muted: boolean; blocked: boolean }) => void) | null = null;

vi.mock('../video', () => {
  const FakeVideo = (props: Record<string, unknown>) => {
    // 'theater' is the only one rendered with layout="wide"; the card's two
    // modes are told apart by the continuation-only startTime prop.
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
          autoPlayUnmuted: props.autoPlayUnmuted as boolean | undefined,
          startMuted: props.startMuted as boolean | undefined,
        });
        states.set(role, {
          time: (props.startTime as number | undefined) ?? 0,
          muted: Boolean(props.startMuted),
          paused: !(props.autoPlay || props.autoPlayUnmuted || props.playWhenHovered),
          duration: 600,
        });
      }
    }
    if (role === 'theater' && props.onMutedFallbackChange) {
      mutedFallbackCb = props.onMutedFallbackChange as (s: { muted: boolean; blocked: boolean }) => void;
    }
    useImperativeHandle(
      props.playerHandleRef as Ref<unknown>,
      () => ({
        getCurrentTime: () => states.get(role)?.time ?? 0,
        getDuration: () => states.get(role)?.duration ?? 0,
        getPaused: () => states.get(role)?.paused ?? true,
        getMuted: () => states.get(role)?.muted ?? false,
        play: () => {
          const s = states.get(role);
          if (s) s.paused = false;
          // The real handle's play() returns a promise; keep the mock's contract
          // identical so the code under test still exercises the async path.
          return Promise.resolve();
        },
        pause: () => {
          const s = states.get(role);
          if (s) s.paused = true;
        },
        setMuted: (m: boolean) => {
          const s = states.get(role);
          if (s) s.muted = m;
        },
      }),
      [role],
    );
    return <div data-role={role} />;
  };
  return { Video: FakeVideo };
});

const VIDEO = { id: 'v1', mainVideoUrl: 'https://example.com/a.m3u8', posterUrl: null, title: 'Demo' };

function theaterConstructions() {
  return constructions.filter(c => c.role === 'theater');
}

/** `lib` is ES2020 here, so `Array.prototype.at` is not available. */
function last<T>(xs: T[]): T | undefined {
  return xs.length > 0 ? xs[xs.length - 1] : undefined;
}

describe('walkthrough-video: host-driven open/close handoff', () => {
  beforeEach(() => {
    constructions.length = 0;
    states.clear();
    mutedFallbackCb = null;
  });

  it('A — host opens cold: theater starts at 0, unmuted, autoplaying', () => {
    const view = render(<InlineWalkthroughVideo video={VIDEO} open={false} onOpenChange={() => {}} />);
    act(() => {
      view.rerender(<InlineWalkthroughVideo video={VIDEO} open onOpenChange={() => {}} />);
    });
    expect(theaterConstructions()).toEqual([
      { role: 'theater', startTime: 0, autoPlay: false, autoPlayUnmuted: true, startMuted: false },
    ]);
  });

  it('B — host close snapshots the live theater, host reopen resumes from the LIVE mini player', async () => {
    const onOpenChange = vi.fn();
    const view = render(<InlineWalkthroughVideo video={VIDEO} open={false} onOpenChange={onOpenChange} />);
    // 1. host opens
    act(() => {
      view.rerender(<InlineWalkthroughVideo video={VIDEO} open onOpenChange={onOpenChange} />);
    });
    // 2. the visitor watches to 0:42
    const theater = states.get('theater');
    expect(theater).toBeDefined();
    if (theater) {
      theater.time = 42;
      theater.paused = false;
    }
    // 3. host closes (bypasses handleOpenChange) — falling edge must snapshot
    act(() => {
      view.rerender(<InlineWalkthroughVideo video={VIDEO} open={false} onOpenChange={onOpenChange} />);
    });
    // The theater player was paused by the snapshot.
    expect(states.get('theater')?.paused).toBe(true);
    // 4. the card's resume (continuation) player mounts at 0:42 and plays on
    await waitFor(() => {
      expect(constructions.some(c => c.role === 'resume')).toBe(true);
    });
    const resumeCtor = last(constructions.filter(c => c.role === 'resume'));
    expect(resumeCtor?.startTime).toBe(42);
    // 5. it runs on to 1:00
    const resume = states.get('resume');
    if (resume) resume.time = 60;
    // 6. host reopens — the seed must come from the LIVE mini player (60),
    //    not from the stored handoff (42). This is the assertion that fails if
    //    the rising-edge seed is moved out of render.
    act(() => {
      view.rerender(<InlineWalkthroughVideo video={VIDEO} open onOpenChange={onOpenChange} />);
    });
    const reopened = last(theaterConstructions());
    expect(theaterConstructions()).toHaveLength(2);
    expect(reopened?.startTime).toBe(60);
    expect(reopened?.startMuted).toBe(false);
  });

  it('C — a policy-forced mute never becomes standing mute intent', async () => {
    const view = render(<InlineWalkthroughVideo video={VIDEO} open={false} onOpenChange={() => {}} />);
    act(() => {
      view.rerender(<InlineWalkthroughVideo video={VIDEO} open onOpenChange={() => {}} />);
    });
    // Autoplay policy rejected sound: the element is muted, the user never asked.
    act(() => {
      mutedFallbackCb?.({ muted: true, blocked: false });
    });
    const theater = states.get('theater');
    if (theater) {
      theater.muted = true;
      theater.time = 30;
      theater.paused = false;
    }
    act(() => {
      view.rerender(<InlineWalkthroughVideo video={VIDEO} open={false} onOpenChange={() => {}} />);
    });
    await waitFor(() => {
      expect(constructions.some(c => c.role === 'resume')).toBe(true);
    });
    const resume = last(constructions.filter(c => c.role === 'resume'));
    // The handoff carries the element's muted state...
    expect(resume?.startMuted).toBe(true);
    // ...but it must not have been promoted into standing intent: clearing the
    // handoff and reopening cold gives an unmuted theater again.
    states.delete('resume');
    act(() => {
      view.rerender(<InlineWalkthroughVideo video={VIDEO} open onOpenChange={() => {}} />);
    });
    const reopened = last(theaterConstructions());
    expect(reopened?.startMuted).toBe(false);
  });

  it('D — a self-driven close (the dialog X) is not re-snapshotted by the sync', async () => {
    let openState = false;
    // `onOpenChange` has to re-render the very view that render() returns, so the
    // handle is held in a const box rather than a forward-declared `let`.
    const box: { view?: ReturnType<typeof render> } = {};
    const onOpenChange = (next: boolean) => {
      openState = next;
      box.view?.rerender(<InlineWalkthroughVideo video={VIDEO} open={openState} onOpenChange={onOpenChange} />);
    };
    box.view = render(<InlineWalkthroughVideo video={VIDEO} open={false} onOpenChange={onOpenChange} />);
    act(() => {
      openState = true;
      box.view?.rerender(<InlineWalkthroughVideo video={VIDEO} open onOpenChange={onOpenChange} />);
    });
    const theater = states.get('theater');
    if (theater) {
      theater.time = 90;
      theater.paused = false;
    }
    // Close via the dialog's own control -> handleOpenChange -> onOpenChange.
    const closeBtn = screen.getByRole('button', { name: /close/i });
    act(() => {
      closeBtn.click();
    });
    await waitFor(() => {
      expect(constructions.some(c => c.role === 'resume')).toBe(true);
    });
    const resumeCtor = last(constructions.filter(c => c.role === 'resume'));
    // The handler's own snapshot (playing at 1:30) must survive — a second
    // snapshot from the sync would have read paused=true and downgraded it.
    expect(resumeCtor?.startTime).toBe(90);
    expect(resumeCtor?.autoPlay || resumeCtor?.autoPlayUnmuted).toBe(true);
  });
});
