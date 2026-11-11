/**
 * THE motion vocabulary: how things enter, leave and move, and for how long.
 *
 * Material 3's emphasized curves (an exit is faster than an entry) and no bounce or spring anywhere: a scene that
 * carries a message moves calmly. Only `transform`, `opacity`, `stroke-dashoffset` and `offset-distance` are animated
 * with these, never a box's size or position, so every frame stays on the compositor.
 *
 * The values are written here once. Script animations (the Web Animations API) need them as strings, which a CSS
 * variable cannot give them; the stylesheet's `--ease-enter`, `--ease-exit` and `--ease-move` in
 * `ods-design-tokens.css` carry the same values for CSS, and a test holds the two equal.
 */
export const MOTION_EASING = {
  /** Something arrives and settles into place (emphasized decelerate). */
  enter: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  /** Something leaves, quickly (emphasized accelerate). */
  exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  /** Something travels from one place to another, or changes state in place (emphasized). */
  move: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export type MotionEasing = keyof typeof MOTION_EASING;

export const MOTION_DURATION_MS = {
  /** An entry. */
  enter: 450,
  /** An exit: faster than an entry. */
  exit: 220,
  /** The old words of a box leave before its new words come in. */
  swap: 160,
  /** The shortest travel. */
  moveShort: 600,
  /** The longest travel (a path across a page). */
  moveLong: 1200,
} as const;

/** Between the members of a group that arrive one after another (a wave across several faces). */
export const MOTION_STAGGER_MS = 90;

/** How far a thing at rest may drift, so a still scene reads as alive without drawing the eye. */
export const MOTION_IDLE_DRIFT_PX = 4;
