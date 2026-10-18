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
import { forwardRef, type ComponentType, type ImgHTMLAttributes, type Ref } from 'react';

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

const Image = forwardRef<HTMLImageElement, ImageProps>(function NextImageShim({ optimizedWidth, ...given }, ref) {
  // A picture asked for at a width is the host resizer's URL, drawn as it comes.
  const props: ImageProps =
    optimizedWidth && resizer && typeof given.src === 'string'
      ? { ...given, src: resizer(given.src, optimizedWidth), unoptimized: true }
      : given;
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
    return <Real ref={ref} {...props} fetchPriority={fetchPriority} />;
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

export default Image;
