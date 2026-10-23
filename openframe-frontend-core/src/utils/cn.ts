import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * EVERY custom `text-*` utility we add in `tailwind.config.ts` MUST be listed here.
 *
 * tailwind-merge has no knowledge of our utilities, and `text-<word>` is
 * indistinguishable from a text COLOUR to it. So an unlisted `text-badge` gets
 * filed in tailwind-merge's `text-color` group, where it and any real colour
 * class silently annihilate each other — last one wins, the other is dropped
 * from the output entirely:
 *
 *   cn('text-badge', 'text-ods-text-on-accent')  -> 'text-ods-text-on-accent'  (size lost)
 *   cn('text-[--some-colour]', 'text-badge')     -> 'text-badge'               (colour lost)
 *
 * Listing them in their own group makes them non-conflicting with colours, so
 * both survive. This is why `text-h1`…`text-h6` are here; `text-code` and
 * `text-badge` were added to the config later and missing them shipped exactly
 * the two failures above (huge badges, and badge text losing its colour).
 */
const twMerge = extendTailwindMerge<'ods-typography'>({
  extend: {
    classGroups: {
      'ods-typography': ['text-h1', 'text-h2', 'text-h3', 'text-h4', 'text-h5', 'text-h6', 'text-code', 'text-badge'],
    },
  },
});

/**
 * Combine class names with Tailwind's merge utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
