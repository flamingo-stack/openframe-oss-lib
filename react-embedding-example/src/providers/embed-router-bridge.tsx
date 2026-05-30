// Adapts react-router into the lib's embed-shims so every lib surface navigates
// and re-renders in this SPA. The lib's shim contract (NavigationImpl) expects a
// RouterStub from useRouter(), a bare string from usePathname(), and a bare
// URLSearchParams from useSearchParams() — react-router's hooks don't match those
// shapes (useNavigate is a function; useSearchParams returns a [params, setter]
// tuple), so we MUST adapt, not register them raw.
//
// This file is .tsx because LinkAdapter contains JSX. Call registerEmbedRouterBridge()
// ONCE before the first lib surface renders (see main.tsx).
import { forwardRef, useMemo, type AnchorHTMLAttributes } from 'react'
import { Link as RRLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { registerNavigation, registerLink } from '@flamingo-stack/openframe-frontend-core/embed-shims'

// registerLink receives components with the NEXT <Link> prop shape (href + the
// passed-through prefetch/replace/scroll). react-router's <Link> wants `to`, so map
// href→to and drop the Next-only props (react-router has no such props).
type NextLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href?: string
  prefetch?: boolean | null
  replace?: boolean
  scroll?: boolean
}

const LinkAdapter = forwardRef<HTMLAnchorElement, NextLinkProps>(function LinkAdapter(
  { href, children, prefetch: _prefetch, replace, scroll: _scroll, ...rest },
  ref,
) {
  return (
    <RRLink ref={ref} to={href ?? ''} replace={replace} {...rest}>
      {children}
    </RRLink>
  )
})

let registered = false

export function registerEmbedRouterBridge(): void {
  if (registered) return
  registered = true

  registerNavigation({
    useRouter: () => {
      const nav = useNavigate()
      // Memoize so consumers (e.g. useDocSearch's useCallback) don't see a new ref each render.
      return useMemo(
        () => ({
          push: (href: string) => nav(href),
          replace: (href: string) => nav(href, { replace: true }),
          back: () => nav(-1),
          forward: () => nav(1),
          refresh: () => {},
          prefetch: () => {},
        }),
        [nav],
      )
    },
    usePathname: () => useLocation().pathname,
    useSearchParams: () => useSearchParams()[0], // unwrap react-router's [params, setter] tuple
  })

  registerLink(LinkAdapter)
}
