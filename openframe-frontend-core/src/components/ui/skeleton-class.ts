/**
 * THE skeleton look: a pulsing, rounded block in the border colour. `Skeleton`
 * draws it. A plain module (no `'use client'`), so a server component reads the
 * class itself.
 */
export const SKELETON_CLASS = 'animate-pulse rounded-md bg-ods-border';

/**
 * The same look on words (`TextHold`): one rounded bar per line they wrap to,
 * pulsing like `Skeleton` (`ods-skeleton-text`, `styles/ods-skeleton.css`).
 */
export const SKELETON_TEXT_CLASS = 'animate-pulse ods-skeleton-text';
