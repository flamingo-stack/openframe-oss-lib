'use client';

import { lazy, type LazyExoticComponent, Suspense } from 'react';
import { ProductScreenFrame, type ProductScreenFrameProps } from '../ui/product-screen-frame';
import { Skeleton } from '../ui/skeleton';
import { PRODUCT_SCREEN_LOADERS } from './registry';
import { PRODUCT_SCREEN_KEYS, PRODUCT_SCREEN_LABELS, type ProductScreenKey } from './screen-keys';
import type { ProductScreenComponent } from './types';

/** One lazy component per screen, made once: a screen's code is fetched the first time it renders. */
const LAZY_SCREENS = Object.fromEntries(
  PRODUCT_SCREEN_KEYS.map(key => [key, lazy(PRODUCT_SCREEN_LOADERS[key])]),
) as Record<ProductScreenKey, LazyExoticComponent<ProductScreenComponent>>;

/** Frame heights of the two renderings: constants, so a skeleton and the loaded screen are one box. */
export const PRODUCT_SCREEN_HEIGHT = 440;
export const PRODUCT_SCREEN_COMPACT_HEIGHT = 300;

export interface ProductScreenProps extends Omit<ProductScreenFrameProps, 'children' | 'label' | 'height'> {
  screen: ProductScreenKey;
  /** The narrow rendering in the short frame. */
  compact?: boolean;
  /** Overrides the registry's label. */
  label?: string;
  /** Overrides the frame height of the rendering. */
  height?: number | string;
}

/** The box a product screen occupies while it loads. */
export function ProductScreenSkeleton({
  compact = false,
  height,
  className,
}: Pick<ProductScreenProps, 'compact' | 'height' | 'className'>) {
  return (
    <Skeleton
      className={className}
      style={{ height: height ?? (compact ? PRODUCT_SCREEN_COMPACT_HEIGHT : PRODUCT_SCREEN_HEIGHT) }}
    />
  );
}

/**
 * One product screen of the registry, in its frame. The screen's code is
 * downloaded when this mounts; until then the frame holds its box.
 */
export function ProductScreen({ screen, compact = false, label, height, ...frame }: ProductScreenProps) {
  const Screen = LAZY_SCREENS[screen];
  const frameHeight = height ?? (compact ? PRODUCT_SCREEN_COMPACT_HEIGHT : PRODUCT_SCREEN_HEIGHT);
  return (
    <ProductScreenFrame {...frame} label={label ?? PRODUCT_SCREEN_LABELS[screen]} height={frameHeight}>
      <Suspense fallback={<Skeleton className="h-full w-full" />}>
        <Screen compact={compact} />
      </Suspense>
    </ProductScreenFrame>
  );
}
