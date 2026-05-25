/**
 * `next/link` shim — environment-aware Link component.
 *
 * Defaults to a plain `<a>` so non-Next hosts (Vite, CRA, esbuild)
 * work out of the box. Next.js hosts can opt into the REAL `next/link`
 * (with client-router prefetching) by calling {@link registerLink}
 * ONCE at app init:
 *
 *   // hub: lib/embed-shim-registration.ts
 *   import NextLink from 'next/link'
 *   import { registerLink } from '@flamingo-stack/openframe-frontend-core/embed-shims'
 *   registerLink(NextLink)
 *
 * After registration, every lib component that renders this shim
 * delegates to `NextLink` — prefetch, replace, scroll, locale, etc.
 * all work as expected. Without registration, the shim falls through
 * to the plain `<a>` path that drops Next-specific props.
 *
 * Lib internals import this shim directly (relative path); hub-side
 * code goes through the barrel (`@flamingo-stack/.../embed-shims`).
 */
'use client'
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from 'react'

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href?: string | { pathname?: string; query?: Record<string, string> }
  prefetch?: boolean | null
  replace?: boolean
  scroll?: boolean
  shallow?: boolean
  passHref?: boolean
  legacyBehavior?: boolean
  locale?: string | false
  children?: ReactNode
}

let impl: ComponentType<any> | null = null

/**
 * Register the real `next/link` so this shim delegates to it instead
 * of rendering a plain `<a>`. Call ONCE at app init in a Next.js host.
 */
export function registerLink(component: ComponentType<any>): void {
  impl = component
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function NextLinkShim(
  props,
  ref,
) {
  // Real impl path — registered by the host. Hand off untouched so
  // every Next-specific prop (prefetch, replace, scroll, locale…)
  // reaches the real component intact.
  if (impl) {
    const Real = impl
    return <Real ref={ref} {...props} />
  }

  // Fallback path — plain <a>. Drops Next-only props and reduces
  // `UrlObject` href to its pathname.
  const {
    href,
    children,
    prefetch: _prefetch,
    replace: _replace,
    scroll: _scroll,
    shallow: _shallow,
    passHref: _passHref,
    legacyBehavior: _legacyBehavior,
    locale: _locale,
    ...rest
  } = props
  const hrefStr =
    typeof href === 'string'
      ? href
      : href?.pathname
        ? href.pathname
        : undefined
  return (
    <a ref={ref} href={hrefStr} {...rest}>
      {children}
    </a>
  )
})

export default Link
