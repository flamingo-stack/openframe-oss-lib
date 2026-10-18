'use client';

import { lazy, type LazyExoticComponent, type ReactNode, Suspense } from 'react';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { ProductScreenFrame, type ProductScreenFrameProps } from '../ui/product-screen-frame';
import { PRODUCT_SCREEN_LOADERS } from './registry';
import { PRODUCT_SCREEN_KEYS, PRODUCT_SCREEN_LABELS, type ProductScreenKey } from './screen-keys';
import { PRODUCT_SCREEN_SKELETONS } from './screen-skeletons';
import type { ProductScreenComponent } from './types';

/** One lazy component per screen, made once: a screen's code is fetched the first time it renders. */
const LAZY_SCREENS = Object.fromEntries(
  PRODUCT_SCREEN_KEYS.map(key => [key, lazy(PRODUCT_SCREEN_LOADERS[key])]),
) as Record<ProductScreenKey, LazyExoticComponent<ProductScreenComponent>>;

/** Frame heights of the two renderings: constants, so a skeleton and the loaded screen are one box. */
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

/** A screen's frame: its label, height and layout width, shared by the screen and by its skeleton. */
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

/** What a screen draws while its code loads: its own skeleton (`PRODUCT_SCREEN_SKELETONS`), else the frame's box. */
function ScreenLoading({ screen, compact }: { screen: ProductScreenKey; compact: boolean }) {
  const Skeleton = PRODUCT_SCREEN_SKELETONS[screen];
  return Skeleton ? <Skeleton compact={compact} /> : <UnifiedSkeleton className="h-full w-full" />;
}

/**
 * A product screen while it loads. Given a `screen`, the screen's own frame (its layout width, scale and height)
 * around that screen's skeleton, so it is the loaded picture's box; without one, the box the frame occupies.
 */
export function ProductScreenSkeleton({
  screen,
  compact = false,
  height,
  className,
  ...frame
}: Partial<Pick<ProductScreenProps, 'screen'>> & Omit<ProductScreenProps, 'screen'>) {
  if (screen) {
    return (
      <ProductScreenShell screen={screen} compact={compact} height={height} className={className} {...frame}>
        <ScreenLoading screen={screen} compact={compact} />
      </ProductScreenShell>
    );
  }
  return (
    <UnifiedSkeleton
      className={className}
      height={height ?? (compact ? PRODUCT_SCREEN_COMPACT_HEIGHT : PRODUCT_SCREEN_HEIGHT)}
    />
  );
}

/**
 * One product screen of the registry, in its frame. The screen's code is
 * downloaded when this mounts; until then the frame draws the screen's skeleton.
 */
export function ProductScreen({ screen, compact = false, ...frame }: ProductScreenProps) {
  const Screen = LAZY_SCREENS[screen];
  return (
    <ProductScreenShell screen={screen} compact={compact} {...frame}>
      <Suspense fallback={<ScreenLoading screen={screen} compact={compact} />}>
        <Screen compact={compact} />
      </Suspense>
    </ProductScreenShell>
  );
}
