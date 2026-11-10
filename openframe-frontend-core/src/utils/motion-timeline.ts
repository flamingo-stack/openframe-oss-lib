import { MOTION_EASING } from './motion';

/**
 * The clock of a scripted scene whose beats overlap and fall at uneven times (a person asks at 0.4 s, another at
 * 1.6 s, an approval travels at 7.8 s), which a step player cannot pace. It owns two things and nothing else:
 *
 *   - WHEN: callbacks scheduled on the scene's own clock (`at`). The clock advances only while the scene plays, so a
 *     hold leaves every beat where it was and resumes with what was left, never skipping or replaying one;
 *   - HOW: every element animation (`animate`, the Web Animations API). All of them pause and play together with the
 *     clock, and an element runs ONE animation at a time: a new one first settles the old one where it is, so two
 *     never fight over the same property.
 *
 * It decides nothing about content and nothing about when to hold: the host says `setHeld` (its rule is
 * `useAutoplay`'s plus anything of its own, such as a pause button). Framework-free and safe to import on a server:
 * nothing touches the browser until `start`.
 */
export interface MotionTimeline {
  /** Run `fn` once `delayMs` of playing time from now has passed. */
  at(delayMs: number, fn: () => void): void;
  /**
   * Animate `el` (fills forwards, `enter` easing unless given): the old animation of the same element is settled
   * and cancelled first. On finish the end state is written to the element's style and the animation released,
   * so a finished scene holds no running animations. Returns null when the element cannot animate.
   */
  animate(el: Element | null | undefined, keyframes: Keyframe[], options?: KeyframeAnimationOptions): Animation | null;
  /** Hold (true) or play (false): the clock and every animation. */
  setHeld(held: boolean): void;
  /** Whether it is held. */
  readonly held: boolean;
  /** Playing time since `start`, in ms. */
  now(): number;
  /** Start the clock (once the scene is ready to move). */
  start(): void;
  /** Stop: cancel every scheduled beat and every animation. The timeline can be started again. */
  stop(): void;
}

/** One frame's largest step: a tab that slept, a frame that stalled, never jumps the scene ahead. */
const MAX_FRAME_MS = 64;

export function createMotionTimeline(): MotionTimeline {
  let queue: Array<{ t: number; fn: () => void }> = [];
  const live = new Set<Animation>();
  let clock = 0;
  let last = 0;
  let frame = 0;
  let held = false;
  let running = false;

  const tick = (now: number) => {
    // The next frame is asked for first, so nothing a beat does can stop the clock.
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min(MAX_FRAME_MS, now - last) : 0;
    last = now;
    if (held) return;
    clock += dt;
    // Due beats run in time order; a beat may schedule another, which the next frame picks up.
    const due = queue.filter(q => q.t <= clock).sort((a, b) => a.t - b.t);
    if (due.length === 0) return;
    queue = queue.filter(q => q.t > clock);
    for (const q of due) {
      // One failing beat is reported and skipped; the beats after it, and the scene, go on.
      try {
        q.fn();
      } catch (error) {
        console.error('[motion-timeline] a scheduled beat failed', error);
      }
    }
  };

  const settle = (animation: Animation) => {
    try {
      animation.commitStyles();
    } catch {
      // An element no longer rendered cannot take its end state; it is going away anyway.
    }
    animation.cancel();
    live.delete(animation);
  };

  return {
    at(delayMs, fn) {
      queue.push({ t: clock + Math.max(0, delayMs), fn });
    },
    animate(el, keyframes, options = {}) {
      if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
      for (const old of el.getAnimations()) {
        if (live.has(old)) settle(old);
      }
      const animation = el.animate(keyframes, { fill: 'forwards', easing: MOTION_EASING.enter, ...options });
      live.add(animation);
      animation.onfinish = () => settle(animation);
      if (held) animation.pause();
      return animation;
    },
    setHeld(next) {
      held = next;
      // Re-anchored so the frame after a hold does not count the time held.
      last = 0;
      for (const animation of live) {
        if (next) animation.pause();
        else animation.play();
      }
    },
    get held() {
      return held;
    },
    now: () => clock,
    start() {
      if (running || typeof requestAnimationFrame !== 'function') return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(tick);
    },
    stop() {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      running = false;
      queue = [];
      for (const animation of [...live]) {
        animation.cancel();
        live.delete(animation);
      }
      clock = 0;
      last = 0;
    },
  };
}
