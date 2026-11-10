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

/**
 * How late a wake may land before the clock stops counting the delay: a tab that slept, a stalled main thread,
 * never jumps the scene ahead.
 */
const MAX_LATE_MS = 64;

/**
 * The clock wakes the main thread only when a beat is due (a timer to the next one), never on every frame: the motion
 * itself is Web Animations, which the compositor plays alone, so a frame callback per vsync would only keep the page
 * rendering (measured on the flamingo.run hero: about 5 s of main-thread work per 10 s at a 4x CPU throttle).
 */
export function createMotionTimeline(): MotionTimeline {
  let queue: Array<{ t: number; fn: () => void }> = [];
  const live = new Set<Animation>();
  let clock = 0;
  // The wall time the clock last caught up to.
  let anchor = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  let running = false;

  const wall = () => (typeof performance === 'undefined' ? Date.now() : performance.now());

  // Bring the clock up to now (only while playing). `limit` caps it: a late wake never runs beats ahead of their time.
  const catchUp = (limit = Infinity) => {
    const t = wall();
    if (running && !held) clock = Math.min(clock + Math.max(0, t - anchor), limit);
    anchor = t;
  };

  // `schedule` and `wake` call each other: the timer for the next due beat, and what runs when it fires.
  let wake: (target: number) => void = () => {};
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!running || held || queue.length === 0) return;
    const next = Math.min(...queue.map(q => q.t));
    timer = setTimeout(() => wake(next), Math.max(0, next - clock));
  };

  wake = (target: number) => {
    timer = undefined;
    catchUp(target + MAX_LATE_MS);
    // Due beats run in time order; a beat may schedule another, which the next wake picks up.
    const due = queue.filter(q => q.t <= clock).sort((a, b) => a.t - b.t);
    queue = queue.filter(q => q.t > clock);
    for (const q of due) {
      // One failing beat is reported and skipped; the beats after it, and the scene, go on.
      try {
        q.fn();
      } catch (error) {
        console.error('[motion-timeline] a scheduled beat failed', error);
      }
    }
    schedule();
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
      catchUp();
      queue.push({ t: clock + Math.max(0, delayMs), fn });
      schedule();
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
      if (next === held) return;
      catchUp();
      held = next;
      for (const animation of live) {
        if (next) animation.pause();
        else animation.play();
      }
      schedule();
    },
    get held() {
      return held;
    },
    now() {
      catchUp();
      return clock;
    },
    start() {
      if (running || typeof setTimeout !== 'function') return;
      running = true;
      anchor = wall();
      schedule();
    },
    stop() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      running = false;
      queue = [];
      for (const animation of [...live]) {
        animation.cancel();
        live.delete(animation);
      }
      clock = 0;
    },
  };
}
