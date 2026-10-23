/**
 * THE two pulses of the library, and the only places `animate-pulse` is written (a test fails on any other).
 * A plain module, with no client directive, so a server component can read the strings itself.
 *
 * - `SKELETON_SURFACE_CLASS`: what a skeleton looks like, the pulsing surface every loading shape draws
 *   (`UnifiedSkeleton` and its presets, `TextHold`'s bars). Every surface carries the `ods-skeleton` marker, and
 *   a surface stops the pulse of every surface inside it: a skeleton drawn inside another one pulses with its
 *   parent, once, never twice over (two opacity animations multiplied read as a faster, harsher pulse).
 * - `LIVE_PULSE_CLASS`: a live indicator that is not a loading state (a "working" status dot, a connecting
 *   light, a busy mark). Same animation and timing as the skeleton, so the page has one rhythm.
 */
export const SKELETON_SURFACE_MARKER = 'ods-skeleton';

// One literal (no interpolation), so a Tailwind scan of the built bundle sees every class.
export const SKELETON_SURFACE_CLASS =
  'ods-skeleton animate-pulse motion-reduce:animate-none bg-ods-skeleton [&_.ods-skeleton]:animate-none';

export const LIVE_PULSE_CLASS = 'animate-pulse motion-reduce:animate-none';
