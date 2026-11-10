/**
 * `createMotionTimeline`: beats run on playing time only, a hold pauses the clock and every animation together, and
 * an element runs one animation at a time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMotionTimeline } from '../motion-timeline';

/** A frame clock the test drives: `advance(ms)` runs frames 16 ms apart. */
let frames: Array<(now: number) => void> = [];
let now = 0;
function advance(ms: number) {
  const end = now + ms;
  while (now < end) {
    now += 16;
    const due = frames;
    frames = [];
    for (const cb of due) cb(now);
  }
}

class FakeAnimation {
  playState: 'running' | 'paused' | 'idle' = 'running';
  onfinish: (() => void) | null = null;
  committed = false;
  pause() {
    this.playState = 'paused';
  }
  play() {
    this.playState = 'running';
  }
  cancel() {
    this.playState = 'idle';
  }
  commitStyles() {
    this.committed = true;
  }
}

function fakeElement() {
  const animations: FakeAnimation[] = [];
  return {
    animations,
    animate: vi.fn(() => {
      const a = new FakeAnimation();
      animations.push(a);
      return a;
    }),
    getAnimations: () => animations.filter(a => a.playState !== 'idle'),
  } as unknown as Element & { animations: FakeAnimation[] };
}

beforeEach(() => {
  frames = [];
  now = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('createMotionTimeline', () => {
  it('runs beats when their playing time has passed, in order', () => {
    const tl = createMotionTimeline();
    const ran: string[] = [];
    tl.at(200, () => ran.push('b'));
    tl.at(100, () => ran.push('a'));
    tl.start();
    advance(150);
    expect(ran).toEqual(['a']);
    advance(100);
    expect(ran).toEqual(['a', 'b']);
  });

  it('does not advance while held, and resumes with what was left', () => {
    const tl = createMotionTimeline();
    const ran = vi.fn();
    tl.at(300, ran);
    tl.start();
    advance(200);
    tl.setHeld(true);
    advance(5000);
    expect(ran).not.toHaveBeenCalled();
    tl.setHeld(false);
    advance(80);
    expect(ran).not.toHaveBeenCalled();
    advance(48);
    expect(ran).toHaveBeenCalledTimes(1);
  });

  it('pauses and plays every animation with the clock, including one started while held', () => {
    const tl = createMotionTimeline();
    const el = fakeElement();
    const a = tl.animate(el, [{ opacity: 1 }]) as unknown as FakeAnimation;
    tl.setHeld(true);
    expect(a.playState).toBe('paused');
    const other = fakeElement();
    const b = tl.animate(other, [{ opacity: 0 }]) as unknown as FakeAnimation;
    expect(b.playState).toBe('paused');
    tl.setHeld(false);
    expect(a.playState).toBe('running');
    expect(b.playState).toBe('running');
  });

  it('settles an element\'s running animation before starting its next one', () => {
    const tl = createMotionTimeline();
    const el = fakeElement();
    const first = tl.animate(el, [{ opacity: 1 }]) as unknown as FakeAnimation;
    tl.animate(el, [{ opacity: 0 }]);
    expect(first.committed).toBe(true);
    expect(first.playState).toBe('idle');
    expect(el.animations).toHaveLength(2);
  });

  it('stop cancels every beat and animation', () => {
    const tl = createMotionTimeline();
    const ran = vi.fn();
    const el = fakeElement();
    tl.at(10, ran);
    const a = tl.animate(el, [{ opacity: 1 }]) as unknown as FakeAnimation;
    tl.start();
    tl.stop();
    advance(100);
    expect(ran).not.toHaveBeenCalled();
    expect(a.playState).toBe('idle');
    expect(tl.now()).toBe(0);
  });

  it('never jumps more than a frame\'s worth after a stall', () => {
    const tl = createMotionTimeline();
    const ran = vi.fn();
    tl.at(500, ran);
    tl.start();
    advance(16);
    // One frame arrives 10 s late (a tab that slept).
    now += 10_000;
    const due = frames;
    frames = [];
    for (const cb of due) cb(now);
    expect(tl.now()).toBeLessThanOrEqual(64);
    expect(ran).not.toHaveBeenCalled();
  });

  it('keeps going when a beat throws: the beats after it run and the clock goes on', () => {
    const tl = createMotionTimeline();
    const ran: string[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    tl.at(100, () => {
      throw new Error('boom');
    });
    tl.at(100, () => ran.push('same frame'));
    tl.at(500, () => ran.push('later'));
    tl.start();
    advance(600);
    expect(ran).toEqual(['same frame', 'later']);
    expect(error).toHaveBeenCalledOnce();
    expect(tl.now()).toBeGreaterThan(500);
  });
});
