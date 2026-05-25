'use client'

/**
 * `next/dynamic` shim — environment-aware lazy loader.
 *
 * Defaults to `React.lazy` so non-Next hosts (Vite, CRA, esbuild) work
 * out of the box. Callers MUST be wrapped in a `<Suspense>` boundary
 * somewhere up the tree (Next.js's runtime provides one automatically;
 * non-Next embedders provide their own).
 *
 * Next.js hosts can opt into the REAL `next/dynamic` (with SSR support,
 * loading components, prefetch hints) by calling {@link registerDynamic}
 * ONCE at app init:
 *
 *   // hub: lib/embed-shim-registration.ts
 *   import nextDynamic from 'next/dynamic'
 *   import { registerDynamic } from '@flamingo-stack/openframe-frontend-core/embed-shims'
 *   registerDynamic(nextDynamic)
 *
 * After registration, every lib call to this shim's default export
 * delegates to `next/dynamic`. Without registration, `ssr` / `loading`
 * options are ignored (React.lazy doesn't support them).
 */
import { lazy, type ComponentType, type ReactNode } from 'react'

interface DynamicOptions {
  loading?: (props: {
    error?: Error | null
    isLoading?: boolean
    pastDelay?: boolean
    retry?: () => void
    timedOut?: boolean
  }) => ReactNode | null
  ssr?: boolean
  suspense?: boolean
}

type DynamicLoader<P> = () => Promise<{ default: ComponentType<P> } | ComponentType<P>>

/** Matches `next/dynamic`'s exported signature. */
type DynamicFn = <P extends Record<string, any> = Record<string, never>>(
  loader: DynamicLoader<P>,
  options?: DynamicOptions,
) => ComponentType<P>

const fallback: DynamicFn = (loader, _options) => {
  // React.lazy expects a loader returning { default }. Wrap loaders
  // that return a bare component (legacy next/dynamic shape).
  const wrapped = () =>
    loader().then((mod: any) => ('default' in mod ? mod : { default: mod }))
  return lazy(wrapped) as unknown as ComponentType<any>
}

let impl: DynamicFn = fallback

/**
 * Register the real `next/dynamic` so this shim delegates to it instead
 * of `React.lazy`. Call ONCE at app init in a Next.js host. The function
 * signature must match `next/dynamic`'s default export.
 */
export function registerDynamic(fn: DynamicFn): void {
  impl = fn
}

export default function dynamic<P extends Record<string, any> = Record<string, never>>(
  loader: DynamicLoader<P>,
  options?: DynamicOptions,
): ComponentType<P> {
  return impl(loader, options)
}
