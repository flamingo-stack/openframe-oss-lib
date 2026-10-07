'use client';

import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { LAYOUT_STEPS } from '../../styles/layout-steps';
import { cn } from '../../utils/cn';
import { CollisionBoundaryContext, PortalContainerContext } from './portal-container';

/** The widest content step: a product screen is drawn at this width and scaled to its frame. */
export const PRODUCT_SCREEN_DESIGN_WIDTH = LAYOUT_STEPS['2xl'].content;

/**
 * A narrower layout width for a frame that is itself narrow (a hero's window, a
 * tab panel): the product's desktop layout at its smallest, so the scaled text
 * stays readable.
 */
export const PRODUCT_SCREEN_READABLE_WIDTH = LAYOUT_STEPS.lg.content;

/** Under this frame width the screen is not scaled: it takes the product's own narrow layout. */
export const PRODUCT_SCREEN_SCALE_FROM = LAYOUT_STEPS.md.content;

/** The frame's CSS variable that carries the screen's scale. */
const SCALE_VAR = '--product-screen-scale';

export interface ProductScreenFrameProps {
  /** The product screen: the product's own component with fixture data. */
  children: ReactNode;
  /** What the picture shows, for assistive tech (the content itself is hidden from it). */
  label: string;
  /** Height of the frame; the screen is cropped to it. A number is px. */
  height: number | string;
  /** Whose accent the screen carries. Default `openframe`. */
  appType?: string;
  /** Width the screen is laid out at before scaling. Default the widest content step. */
  designWidth?: number;
  /** The frame width from which the screen is scaled; under it the product's narrow layout renders. Default the content `md` step. */
  scaleFrom?: number;
  /** Fade the cropped bottom edge into the surface behind the frame. Default true. */
  fade?: boolean;
  className?: string;
}

/**
 * A product screen shown as a picture on a marketing page.
 *
 * The child is the real product component. The frame is a content area, so
 * every `content-*` layout switch inside reads the FRAME's width, never the
 * window's. From the content `md` step up the child is laid out at
 * `designWidth` and scaled down to the frame (a transform does not change the
 * width a container query reads, so it keeps its desktop layout); under that
 * step it is not scaled and renders the product's own narrow layout.
 *
 * It is a picture: the content is `inert` and hidden from assistive tech, and
 * the frame is `role="img"` with `label`. Overlays the content opens (a menu a
 * fixture shows open) portal into the frame and collide with its edges, and
 * the frame's `data-app-type` gives them the product's accent too.
 */
export function ProductScreenFrame({
  children,
  label,
  height,
  appType = 'openframe',
  designWidth = PRODUCT_SCREEN_DESIGN_WIDTH,
  scaleFrom = PRODUCT_SCREEN_SCALE_FROM,
  fade = true,
  className,
}: ProductScreenFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [portalHost, setPortalHost] = useState<HTMLDivElement | null>(null);
  // Which layout the screen takes. `pending` until measured: the frame keeps its
  // box and shows nothing, so the first paint is never the unscaled screen.
  // React holds only this (it changes at two widths); the scale itself changes
  // with every pixel of a resize, so it is written to a CSS variable on the
  // frame and never re-renders the screen.
  const [mode, setMode] = useState<'pending' | 'scaled' | 'native'>('pending');

  useLayoutEffect(() => {
    const element = frameRef.current;
    if (!element) return undefined;
    setFrame(element);
    const measure = () => {
      const width = element.clientWidth;
      const scaled = width >= scaleFrom && width < designWidth;
      element.style.setProperty(SCALE_VAR, String(scaled ? width / designWidth : 1));
      setMode(scaled ? 'scaled' : 'native');
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [designWidth, scaleFrom]);

  const screenStyle: CSSProperties =
    mode === 'scaled'
      ? {
          width: designWidth,
          // The crop is in frame pixels, so the unscaled box is taller by the same factor.
          height: `calc(100% / var(${SCALE_VAR}))`,
          transform: `scale(var(${SCALE_VAR}))`,
          transformOrigin: 'top left',
        }
      : // Unscaled, the screen still needs to be the containing block of anything the
        // product pins with `position: fixed` (a form's action bar), or it escapes to the window.
        { width: '100%', height: '100%', transform: 'translateZ(0)' };

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label={label}
      data-app-type={appType}
      className={cn('relative overflow-hidden', className)}
      style={{ height }}
    >
      <PortalContainerContext.Provider value={portalHost}>
        <CollisionBoundaryContext.Provider value={frame}>
          <div
            inert
            aria-hidden
            className={cn('ods-content-area', mode === 'pending' && 'invisible')}
            style={screenStyle}
          >
            <div className="ods-content-scope">{children}</div>
            <div ref={setPortalHost} style={{ display: 'contents' }} />
          </div>
        </CollisionBoundaryContext.Provider>
      </PortalContainerContext.Provider>
      {fade && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ods-bg to-transparent"
        />
      )}
    </div>
  );
}
