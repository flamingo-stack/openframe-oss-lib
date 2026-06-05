import { cn } from '../../utils/cn'

export interface ColorSwatchProps {
  color: string
  className?: string
}

/** Square color preview shared across color and status selectors. */
export function ColorSwatch({ color, className }: ColorSwatchProps) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-4 shrink-0 rounded-sm', className)}
      style={{ backgroundColor: color }}
    />
  )
}
