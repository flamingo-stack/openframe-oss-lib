import { TextLineSkeleton } from '../loading/unified-skeleton';
import { FIELD_VALUE_SKELETON_CLASS } from './input-styles';

/**
 * A field's value (or placeholder) while it is read: the `text-h4` bar in the field's value slot. Drawn by `Input`,
 * `SelectTrigger` and `InputTrigger` in a loading scope, so every field draws the same bar in the same place, between
 * its own real adornments.
 */
export function FieldValueSkeleton() {
  return <TextLineSkeleton type="h4" className={FIELD_VALUE_SKELETON_CLASS} />;
}
