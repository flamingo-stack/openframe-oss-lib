'use client';

import { type ReactNode, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { PanelResizeHandle } from '../ui/panel-resize-handle';

/** The sheet's floor: a header and a few lines of thread. */
const DEFAULT_MIN_HEIGHT = 320;
/** Share of the layer the sheet opens at until the user drags it. */
const DEFAULT_SHARE = 0.64;

export interface ComposerSheetProps {
  /** Drawn only while open; closed, nothing renders. */
  open: boolean;
  /** A click on the scrim: the host closes the sheet (or minimises it). */
  onDismiss: () => void;
  /** The height the user dragged it to, in px; `null` opens it at `defaultShare`. */
  height: number | null;
  /** A finished drag or a keyboard step, clamped to `minHeight` … the layer's height. */
  onHeightChange: (height: number) => void;
  /** Share of the layer the sheet takes while `height` is null. Default 0.64. */
  defaultShare?: number;
  /** Default 320. */
  minHeight?: number;
  /** The sheet's width — the composer's under it, e.g. `max-w-[880px]`. Centred. */
  className?: string;
  /** The dialog's accessible name. */
  'aria-label': string;
  /** What the sheet holds: the host's node a chat portals its header and thread into. */
  children: ReactNode;
}

/**
 * The conversation sheet over a page: it rises from the docked composer, the page
 * stays beneath under a scrim, and a grip on its top edge resizes it from
 * `minHeight` to the full height of the layer. Meant for `AppLayout`'s
 * `composerSheet` layer, whose bottom is the dock's top edge: the sheet stands on
 * the composer, so the two read as one card (no bottom border, no bottom radius).
 *
 * The host owns everything that decides WHEN it shows — Esc, navigation, the
 * composer's draft — and only hears of a scrim click here. It paints the sheet's
 * ground (the portalled thread paints none) and keeps no transform on it: the
 * thread's menus portal inside, and a transformed ancestor would move them.
 */
export function ComposerSheet({
  open,
  onDismiss,
  height,
  onHeightChange,
  defaultShare = DEFAULT_SHARE,
  minHeight = DEFAULT_MIN_HEIGHT,
  className,
  'aria-label': ariaLabel,
  children,
}: ComposerSheetProps) {
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [layerHeight, setLayerHeight] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!layer) return undefined;
    const update = () => setLayerHeight(layer.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [layer]);

  if (!open) return null;

  // The first render of an open sheet comes before the layer is measured: no ceiling
  // yet (CSS `max-height: 100%` holds it to the layer), or a given height would draw at
  // the floor for that frame and grow from it.
  const measured = layerHeight > 0;
  const maxHeight = measured ? Math.max(minHeight, layerHeight) : Number.POSITIVE_INFINITY;
  const clamp = (next: number) => Math.round(Math.min(maxHeight, Math.max(minHeight, next)));
  // Until the layer is measured the share is a percentage, so the first frame is right.
  const resolved = height === null ? (measured ? clamp(layerHeight * defaultShare) : null) : clamp(height);

  return (
    <div ref={setLayer} className="absolute inset-0">
      <div
        aria-hidden
        data-testid="composer-sheet-scrim"
        className="pointer-events-auto absolute inset-0 bg-ods-overlay duration-200 animate-in fade-in-0"
        onClick={onDismiss}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          'pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex w-full flex-col',
          'rounded-t-md border border-b-0 border-ods-border bg-ods-bg shadow-xl',
          // No `duration-*` here: with no transition property set it would ease
          // every change of the height — a drag lagging behind the pointer.
          'animate-in fade-in-0 slide-in-from-bottom-4',
          className,
        )}
        style={{
          height: resolved ?? `${Math.round(defaultShare * 100)}%`,
          minHeight,
          maxHeight: '100%',
        }}
      >
        {/* The grip's anchor: the handle stands on this line, 12px under the
            sheet's top edge, so its track covers the top strip of the sheet. */}
        <div className="relative top-3 h-0 shrink-0">
          <PanelResizeHandle
            side="bottom"
            size={resolved ?? minHeight}
            minSize={minHeight}
            maxSize={measured ? maxHeight : (resolved ?? minHeight)}
            onSize={next => onHeightChange(clamp(next))}
            clampSize={clamp}
            panelRef={panelRef}
            variant="overlay"
            ariaLabel="Resize the chat"
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col pt-3">{children}</div>
      </div>
    </div>
  );
}
