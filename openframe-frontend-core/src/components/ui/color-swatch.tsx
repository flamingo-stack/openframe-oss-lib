import { cn } from '../../utils/cn';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

export interface ColorSwatchProps {
  color: string;
  className?: string;
}

/** The swatch's box, read by the swatch and its loading form. */
const SWATCH_CLASS = 'inline-block size-4 shrink-0 rounded-sm';

/** Square color preview shared across color and status selectors. In a loading scope the color is read data not here
 *  yet: the swatch draws its box as a skeleton. */
export function ColorSwatch({ color, className }: ColorSwatchProps) {
  if (useLoadingScope()) return <UnifiedSkeleton aria-hidden className={cn(SWATCH_CLASS, className)} />;
  return <span aria-hidden className={cn(SWATCH_CLASS, className)} style={{ backgroundColor: color }} />;
}
