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

const Image = forwardRef<HTMLImageElement, ImageProps>(function NextImageShim(props, ref) {
  // Real impl path — registered by the host. Hand off untouched so
  // every Next-specific prop (priority, placeholder, sizes, loader…)
  // reaches the real component intact.
  if (impl) {
    const Real = impl;
    return <Real ref={ref} {...props} />;
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
    />
  );
});

export default Image;
