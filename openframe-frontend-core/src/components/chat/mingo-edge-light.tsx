import { cn } from '../../utils/cn';

export interface MingoEdgeLightProps {
  /** The host's corner radius (e.g. `rounded-md`), so the ring follows its outline. */
  className?: string;
}

/**
 * Mingo's AI edge light (`.mingo-edge-frame` / `.mingo-edge` in
 * `styles/chat-animations.css`): an accent arc travelling around the host's
 * outline, clipped to a 1px ring by a CSS mask, so the host's own background
 * shows through. Static under reduced motion. Absolutely positioned over a
 * `relative` host, on its border box; it takes no pointer events.
 */
export function MingoEdgeLight({ className }: MingoEdgeLightProps) {
  return (
    <span
      aria-hidden="true"
      data-testid="mingo-edge-light"
      className={cn('mingo-edge-frame pointer-events-none absolute inset-0', className)}
    >
      <span className="mingo-edge" />
    </span>
  );
}
