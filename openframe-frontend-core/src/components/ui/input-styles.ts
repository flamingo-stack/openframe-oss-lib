/**
 * The text field's box: its height per breakpoint and its radius. A plain module (no client directive), read by
 * `Input` and by `InteractiveSkeleton.Input`, so a field's skeleton is the field's box.
 */
export const INPUT_HEIGHT_CLASS = 'h-11 md:h-12';
export const INPUT_RADIUS_CLASS = 'rounded-[6px]';
/** A field's value (or placeholder) while it is read: the `text-h4` bar in the field's value slot. Read by `Input`,
 *  `SelectTrigger` and `InputTrigger`, so every field draws the same bar. */
export const FIELD_VALUE_SKELETON_CLASS = 'w-1/2 min-w-0 flex-1';
