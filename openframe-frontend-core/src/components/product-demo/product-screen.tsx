'use client';

import { createElement, type ReactNode, useEffect, useState } from 'react';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { LoadingScope, useLoadingScope } from '../ui/loading-scope';
import { ProductScreenFrame, type ProductScreenFrameProps } from '../ui/product-screen-frame';
import { PRODUCT_SCREEN_LOADERS } from './registry';
import { PRODUCT_SCREEN_LABELS, type ProductScreenKey } from './screen-keys';
import { PRODUCT_SCREEN_LOADING } from './screen-loading';
import type { ProductScreenComponent } from './types';

/** The screens whose code has arrived, kept for the page's life: a screen shown again renders at once. */
const LOADED_SCREENS = new Map<ProductScreenKey, ProductScreenComponent>();

/**
 * Fetches a screen's code outside a loading scope (a page's loading state fetches nothing) and re-renders once it is
 * here. No Suspense: the frame keeps the SAME loading view mounted until the code arrives, so the loading state is
 * drawn once and never torn down and mounted again (that was the double loading).
 */
function useScreenCode(screen: ProductScreenKey, fetch: boolean): void {
  const [, setArrived] = useState(0);
  useEffect(() => {
    if (!fetch || LOADED_SCREENS.has(screen)) return undefined;
    let live = true;
    void PRODUCT_SCREEN_LOADERS[screen]().then(module => {
      LOADED_SCREENS.set(screen, module.default);
      if (live) setArrived(count => count + 1);
    });
    return () => {
      live = false;
    };
  }, [screen, fetch]);
}

/** Frame heights of the two renderings: constants, so the loading state and the loaded screen are one box. */
export const PRODUCT_SCREEN_HEIGHT = 440;
export const PRODUCT_SCREEN_COMPACT_HEIGHT = 300;

/**
 * The narrowest layout a screen reads well at, where that is wider than a
 * host's readable width: the device list's customer column breaks a name
 * mid-word below it, and the logs table beside its open drawer has no room
 * for the message; the software form is laid out wide so the package, the
 * schedule and the picked devices all fit the frame's height; the scripts
 * screen puts a schedule's name, its timing and its repeat on one row. A frame never
 * lays such a screen out narrower.
 */
const MIN_LAYOUT_WIDTH: Partial<Record<ProductScreenKey, number>> = {
  devices: 1120,
  logs: 1120,
  'software-update': 1400,
  scripts: 1400,
};

/**
 * A compact screen that has no layout of its own for a card's width: the
 * remote desktop's control bar needs more room than a phone's card gives, so
 * its compact rendering is laid out at this width and scaled to the card, the
 * way a wide frame scales the full page.
 */
const COMPACT_LAYOUT_WIDTH: Partial<Record<ProductScreenKey, number>> = {
  'remote-session': 380,
};

export interface ProductScreenProps extends Omit<ProductScreenFrameProps, 'children' | 'label' | 'height'> {
  screen: ProductScreenKey;
  /** The narrow rendering in the short frame. */
  compact?: boolean;
  /** Overrides the registry's label. */
  label?: string;
  /** Overrides the frame height of the rendering. */
  height?: number | string;
}

/** A screen's frame: its label, height and layout width, shared by the screen and by its loading state. */
function ProductScreenShell({
  screen,
  compact = false,
  label,
  height,
  designWidth,
  children,
  ...frame
}: ProductScreenProps & { children: ReactNode }) {
  const frameHeight = height ?? (compact ? PRODUCT_SCREEN_COMPACT_HEIGHT : PRODUCT_SCREEN_HEIGHT);
  const minWidth = compact ? undefined : MIN_LAYOUT_WIDTH[screen];
  const compactWidth = compact ? COMPACT_LAYOUT_WIDTH[screen] : undefined;
  const layoutWidth =
    compactWidth ??
    // A screen with a minimum keeps it whether or not the host names a width (the frame's default is narrower).
    (minWidth !== undefined ? Math.max(designWidth ?? minWidth, minWidth) : designWidth);
  return (
    <ProductScreenFrame
      {...frame}
      designWidth={layoutWidth}
      // Scaled at every width below its layout width: there is no narrower layout to fall to.
      {...(compactWidth !== undefined && { scaleFrom: 0 })}
      label={label ?? PRODUCT_SCREEN_LABELS[screen]}
      height={frameHeight}
    >
      {children}
    </ProductScreenFrame>
  );
}

/** What a screen draws while its code loads: its own view in its loading state (`PRODUCT_SCREEN_LOADING`), else the
 *  frame's box. */
function ScreenLoading({ screen, compact }: { screen: ProductScreenKey; compact: boolean }) {
  const Loading = PRODUCT_SCREEN_LOADING[screen];
  // Always in a loading scope: before the frame is measured (its scope) and while the screen's code downloads (the
  // Suspense fallback) the view is drawn the SAME way, so the first paint and the fallback are one loading state.
  return (
    <LoadingScope bare>
      {Loading ? <Loading compact={compact} /> : <UnifiedSkeleton className="h-full w-full" />}
    </LoadingScope>
  );
}

/**
 * One product screen of the registry, in its frame. The screen's code is
 * downloaded when this mounts; until then the frame draws the screen in its
 * loading state. In a page's loading scope it stays in that state and fetches
 * nothing.
 */
export function ProductScreen({ screen, compact = false, ...frame }: ProductScreenProps) {
  const loading = useLoadingScope();
  useScreenCode(screen, !loading);
  const Screen = LOADED_SCREENS.get(screen);
  return (
    <ProductScreenShell screen={screen} compact={compact} {...frame}>
      {/* The arrived screen is a module's component, kept in `LOADED_SCREENS`: never created during render. */}
      {loading || !Screen ? <ScreenLoading screen={screen} compact={compact} /> : createElement(Screen, { compact })}
    </ProductScreenShell>
  );
}
