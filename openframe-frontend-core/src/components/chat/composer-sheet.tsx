'use client';

import { type ReactNode, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { PanelResizeHandle } from '../ui/panel-resize-handle';

/** The sheet's floor: a header and a few lines of thread. */
const DEFAULT_MIN_HEIGHT = 320;
/** Share of the layer the sheet opens at until the user drags it. */
const DEFAULT_SHARE = 0.64;
/**
 * The resize tab standing on the sheet's top edge, in px: what the sheet's ceiling gives
 * up, so a sheet at its full height keeps the tab in the layer. Its classes below spell
 * the same size (Tailwind reads literal class names).
 */
const TAB_HEIGHT = 20;

export interface ComposerSheetProps {
  /** Drawn only while open; closed, nothing renders. */
  open: boolean;
  /** A click on the scrim: the host closes the sheet (or minimises it). */
  onDismiss: () => void;
  /** The height the user dragged it to, in px; `null` opens it at `defaultShare`. */
  height: number | null;
  /** A finished drag or a keyboard step, clamped to `minHeight` … the layer's height. */
  onHeightChange: (height: number) => void;
  /** A double click on the resize tab: the host puts the height back to its default. */
  onResetHeight?: () => void;
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

/** The tab's flared foot, where its side meets the sheet's top border: a concave quarter circle. */
function TabFoot({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden
      width="8"
      height="8"
      viewBox="0 0 8 8"
      className={cn('absolute bottom-0', side === 'left' ? 'right-full' : 'left-full -scale-x-100')}
    >
      <path d="M8 0 V8 H0 A8 8 0 0 0 8 0 Z" className="fill-ods-bg" />
      <path d="M0 8 A8 8 0 0 0 8 0" className="fill-none stroke-ods-border" strokeWidth="1" />
    </svg>
  );
}

/** Two lines: the sheet can be pulled by this. */
function TabGrip() {
  return (
    <span aria-hidden className="flex flex-col items-center gap-[3px]">
      <span className="h-0.5 w-6 rounded-full bg-ods-text-secondary transition-colors group-hover:bg-ods-text-primary group-focus-visible:bg-ods-text-primary" />
      <span className="h-0.5 w-6 rounded-full bg-ods-text-secondary transition-colors group-hover:bg-ods-text-primary group-focus-visible:bg-ods-text-primary" />
    </span>
  );
}

/**
 * The conversation sheet over a page: it rises from the docked composer, the page
 * stays beneath under a scrim, and a tab standing on its top edge resizes it from
 * `minHeight` to the full height of the layer (a drag, the arrow keys, Home / End; a
 * double click asks the host for the default height). Meant for `AppLayout`'s
 * `composerSheet` layer, whose bottom is the dock's top edge: the sheet stands above
 * the composer as a card of its own, its header at its top border.
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
  onResetHeight,
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
  // yet (CSS `max-height` holds it to the layer), or a given height would draw at the
  // floor for that frame and grow from it. The tab above the sheet stays in the layer.
  const measured = layerHeight > 0;
  const maxHeight = measured ? Math.max(minHeight, layerHeight - TAB_HEIGHT) : Number.POSITIVE_INFINITY;
  const clamp = (next: number) => Math.round(Math.min(maxHeight, Math.max(minHeight, next)));
  // Until the layer is measured the share is a percentage, so the first frame is right.
  const resolved = height === null ? (measured ? clamp(layerHeight * defaultShare) : null) : clamp(height);

  return (
    <div ref={setLayer} className="absolute inset-0">
      <div
        aria-hidden
        data-testid="composer-sheet-scrim"
        // Down past the layer to the bottom of the column, behind the composer dock
        // (`--of-composer-dock-height`, AppLayout): beside the composer the page reads
        // dimmed too, not as a band of plain ground. The dock sits above it.
        className="pointer-events-auto absolute inset-x-0 -bottom-[var(--of-composer-dock-height,0px)] top-0 bg-ods-overlay duration-200 animate-in fade-in-0"
        onClick={onDismiss}
      />
      {/* The sheet with the tab on it: the size the drag writes, and the dialog. The
          card inside clips its content to its corners, so the tab stands beside it. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          'pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex w-full flex-col',
          // No `duration-*` here: with no transition property set it would ease
          // every change of the height — a drag lagging behind the pointer.
          'animate-in fade-in-0 slide-in-from-bottom-4',
          className,
        )}
        style={{
          height: resolved ?? `${Math.round(defaultShare * 100)}%`,
          minHeight,
          maxHeight: `calc(100% - ${TAB_HEIGHT}px)`,
        }}
      >
        {/* The tab: over the card's top border by a pixel, so the two read as one
            outline, the feet curving it into the border. */}
        <div
          data-testid="composer-sheet-tab"
          className="absolute bottom-[calc(100%-1px)] left-1/2 z-10 h-5 w-16 -translate-x-1/2 rounded-t-md border border-b-0 border-ods-border bg-ods-bg"
          onDoubleClick={onResetHeight}
        >
          <TabFoot side="left" />
          <TabFoot side="right" />
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
            className="inset-0 h-auto w-auto items-center justify-center p-0"
            grip={<TabGrip />}
          />
        </div>
        <div
          data-testid="composer-sheet-card"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg shadow-xl"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
