/**
 * `next/image` shim — environment-aware Image component.
 *
 * Defaults to a plain `<img>` so non-Next hosts (Vite, CRA, esbuild)
 * work out of the box without aliasing tricks. Next.js hosts can opt
 * into the REAL `next/image` (with Image Optimization) by calling
 * {@link registerImage} ONCE at app init:
 *
 *   // hub: lib/embed-shim-registration.ts
 *   import NextImage from 'next/image'
 *   import { registerImage } from '@flamingo-stack/openframe-frontend-core/embed-shims'
 *   registerImage(NextImage)
 *
 * After registration, every lib component that renders this shim
 * delegates to `NextImage` — full Image Optimization, blur placeholders,
 * priority, etc. Without registration, the shim falls through to the
 * plain `<img>` path that drops Next-specific props.
 *
 * Lib internals import this shim directly (relative path); hub-side
 * code goes through the barrel (`@flamingo-stack/.../embed-shims`).
 */
'use client';
import { forwardRef, type ComponentType, type CSSProperties, type ImgHTMLAttributes, type Ref } from 'react';

import { UnifiedSkeleton } from '../components/loading/unified-skeleton';
import { useLoadingScope } from '../components/ui/loading-scope';
import type { AuthedAsset } from '../hooks/use-authed-asset-src';
import { useAuthedImage } from '../hooks/use-authed-image-src';
import { cn } from '../utils/cn';
import { fetchPriorityProp } from '../utils/fetch-priority';

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'placeholder'> & {
  src?: string | { src: string };
  alt?: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
  placeholder?: 'blur' | 'empty' | `data:image/${string}`;
  blurDataURL?: string;
  unoptimized?: boolean;
  /**
   * Draw the picture about this many pixels wide: the host's registered resizer
   * (`registerImageResizer`) answers the URL, and the picture is drawn as it
   * comes, with no second optimizer pass. For a slot whose width the caller
   * measured (a wall column); a host with no resizer draws `src` as usual.
   */
  optimizedWidth?: number;
  onLoadingComplete?: (img: HTMLImageElement) => void;
  loader?: unknown;
  /** The picture's address when `src` is the blob fetched from it (set by the shim; see `drawnAsset`). */
  'data-asset-src'?: string;
};

/** What the shim renders once a host has registered `next/image`. */
type RegisteredImage = ComponentType<ImageProps & { ref?: Ref<HTMLImageElement> }>;

let impl: RegisteredImage | null = null;

/**
 * Register the real `next/image` so this shim delegates to it instead
 * of rendering a plain `<img>`. Call ONCE at app init in a Next.js host
 * — subsequent calls overwrite the registration silently. Safe to skip
 * entirely in non-Next environments.
 */
export function registerImage<P>(component: ComponentType<P>): void {
  // The registration contract IS the assertion: the host states that its
  // component handles the props this shim forwards (`next/image` does). One
  // narrow assertion here, instead of `any` on the slot and on this
  // signature, which erased the type for every caller.
  impl = component as RegisteredImage;
}

/** A host's way to ask for a picture at a smaller width: the same picture, about `widthPx` wide, uncropped. */
type ImageResizer = (src: string, widthPx: number) => string;

let resizer: ImageResizer | null = null;

/**
 * Register how this host serves a picture at a given width (its image
 * transform or optimizer). Code that only needs a few pixels of a picture (a
 * colour sample) asks through {@link resizedImageUrl} and never downloads the
 * original. Without a registration the original URL is used.
 */
export function registerImageResizer(fn: ImageResizer): void {
  resizer = fn;
}

/** The URL of `src` about `widthPx` wide, as the host serves it; `src` itself when the host registered no way. */
export function resizedImageUrl(src: string, widthPx: number): string {
  return resizer ? resizer(src, widthPx) : src;
}

/** A size class on the picture's own classes: its width or height comes from CSS, not from its attributes. */
const SIZED_BY_CLASS = /(?:^|\s)(?:[a-z0-9-]+:)*(?:w|h|size|inset)-(?!auto(?:\s|$))/;

/**
 * The picture in a loading scope: a box where the picture would be, and nothing fetched. It keeps the picture's
 * own classes (its size, radius, position) and its proportions (the `width` / `height` it states), so the box is
 * the size the picture is drawn at.
 */
function HeldImage({ className, style, width, height, fill }: ImageProps) {
  const w = Number(width);
  const h = Number(height);
  const ratio = w > 0 && h > 0 ? `${w} / ${h}` : undefined;
  const boxStyle = fill
    ? { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', ...style }
    : { aspectRatio: ratio, width: SIZED_BY_CLASS.test(className ?? '') || !(w > 0) ? undefined : w, ...style };
  const { width: boxWidth, height: boxHeight, ...rest } = boxStyle as CSSProperties;
  return (
    <UnifiedSkeleton
      as="span"
      variant="rectangular"
      width={boxWidth}
      height={boxHeight}
      // The picture's own classes last, so its size and radius win over the skeleton's defaults.
      className={cn('inline-block h-auto w-auto max-w-full', className)}
      style={{ ...rest, objectFit: undefined, objectPosition: undefined }}
    />
  );
}

const Image = forwardRef<HTMLImageElement, ImageProps>(function NextImageShim({ optimizedWidth, ...given }, ref) {
  // In a loading scope the picture is a box of its own size, and it is not fetched.
  const held = useLoadingScope();
  // A picture asked for at a width is the host resizer's URL, drawn as it comes.
  const sized: ImageProps =
    optimizedWidth && resizer && typeof given.src === 'string'
      ? { ...given, src: resizer(given.src, optimizedWidth), unoptimized: true }
      : given;
  // Every picture is drawn from where it lives and with the credential it needs: the host's `resolveAssetUrl`
  // sends a backend path to its gateway, and a bearer-auth host's picture is fetched with the bearer and drawn
  // from a blob (`useAuthedAsset`). Cookie-auth web and public pictures pass through unchanged.
  const asset = useAuthedImage(!held && typeof sized.src === 'string' ? sized.src : undefined);
  // Waiting for the credential or for the fetch: the picture's box, with nothing requested.
  if (held || asset.status === 'pending') return <HeldImage {...given} />;
  const props: ImageProps = typeof sized.src !== 'string' ? sized : drawnAsset(sized, asset);
  // The element that failed is not the one a retry draws into: a caller that hid it in `onError` would keep it
  // hidden. Only that transition remounts: a native in-place src swap keeps the old picture until the new one loads
  // (a bearer swap draws the box while the new blob is fetched).
  const key = asset.status === 'failed' ? 'failed' : undefined;
  // `priority` means "this is the picture the page is waiting for", so its
  // request is ranked high on EVERY host. Stated here, once: since Next 16
  // `priority` only preloads and no longer ranks the request, and the plain
  // <img> below dropped the prop altogether, so an embedder's hero went out at
  // the default priority. A caller that names its own `fetchPriority` keeps it.
  const fetchPriority = props.fetchPriority ?? (props.priority ? 'high' : undefined);

  // Real impl path — registered by the host. Every Next-specific prop
  // (priority, placeholder, sizes, loader…) reaches the real component intact.
  if (impl) {
    const Real = impl;
    return <Real key={key} ref={ref} {...props} fetchPriority={fetchPriority} />;
  }

  // Fallback path — plain <img>. Drops Next-only props and reduces
  // `StaticImageData` src to a string.
  const {
    src,
    alt,
    width,
    height,
    fill,
    sizes: _sizes,
    quality: _quality,
    priority: _priority,
    placeholder: _placeholder,
    blurDataURL: _blurDataURL,
    unoptimized: _unoptimized,
    onLoadingComplete,
    loader: _loader,
    fetchPriority: _fetchPriority,
    style,
    ...rest
  } = props;
  const srcStr = typeof src === 'string' ? src : src?.src;
  // Mirrors the real `next/image` fill style EXACTLY, which means no
  // `objectFit`: Next sets position/inset/size and leaves object-fit to the
  // caller's className. This shim used to force `objectFit: 'cover'`, and
  // because an inline style beats a class, every `fill` + `object-contain`
  // call site (blog-card, entity-portrait-card, onboarding-guide-card,
  // program-card, og-link-preview, parallax-image-showcase, product-release-card)
  // silently rendered CROPPED on non-Next hosts and contained on Next ones —
  // the one divergence a shim must never have. All 20 `fill` call sites in this
  // library pass an explicit object-fit class, so nothing relied on the default.
  const finalStyle = fill
    ? {
        position: 'absolute' as const,
        inset: 0,
        width: '100%',
        height: '100%',
        ...style,
      }
    : style;
  return (
    <img
      key={key}
      ref={ref}
      src={srcStr}
      alt={alt ?? ''}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={finalStyle}
      onLoad={onLoadingComplete ? e => onLoadingComplete(e.currentTarget) : undefined}
      {...rest}
      // The attribute's spelling depends on the host's React major (`fetchPriorityProp`).
      {...(fetchPriority ? fetchPriorityProp(fetchPriority) : {})}
    />
  );
});

/**
 * The props drawn for a string `src` once `useAuthedAsset` answered:
 *
 * - `native` / `ready`: its `src` (the URL, or the fetched blob). A blob goes to no optimizer.
 * - `failed`: the URL itself, so the element fails the way a plain `<img>` would and the caller's `onError`
 *   fallback runs. It used to stay blank, with nothing to tell the caller.
 *
 * `data-asset-src` keeps the URL on the element when the drawn `src` is a blob, for code that reads a picture's
 * address off the DOM (the chat's click-to-expand gallery).
 */
function drawnAsset(props: ImageProps, asset: AuthedAsset): ImageProps {
  const src = asset.status === 'failed' ? asset.url : asset.src;
  if (asset.status !== 'ready') return { ...props, src };
  return { ...props, src, unoptimized: true, 'data-asset-src': asset.url };
}

export default Image;
