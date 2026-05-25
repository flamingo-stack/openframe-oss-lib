/**
 * Barrel for the `embed-shims/` shims.
 *
 * Each shim is environment-aware: by default it renders a plain HTML
 * equivalent so non-Next hosts (Vite, CRA, esbuild) work out of the
 * box. Next.js hosts opt into the REAL Next primitives by calling the
 * `register*` functions ONCE at app init — see each shim's docblock
 * for the host wiring snippet. After registration, every lib component
 * that renders through these shims delegates to the real Next impl
 * (Image Optimization, client-router prefetching, full app-router
 * navigation, etc.) without further config.
 *
 * Lib internals import each shim directly via its relative path
 * (`../embed-shims/next-link`). Hub and external consumers import
 * through this barrel:
 *
 *   import { Link, Image, dynamic, useRouter, usePathname } from
 *     '@flamingo-stack/openframe-frontend-core/embed-shims'
 *
 * Or per-shim:
 *
 *   import Link  from '@flamingo-stack/openframe-frontend-core/embed-shims/next-link'
 *   import Image from '@flamingo-stack/openframe-frontend-core/embed-shims/next-image'
 *
 * Companion to the docblocks on each individual shim file.
 */
export { default as Image, registerImage } from './next-image'
export { default as Link, registerLink } from './next-link'
export { default as dynamic, registerDynamic } from './next-dynamic'
export {
  useRouter,
  usePathname,
  useSearchParams,
  useParams,
  redirect,
  permanentRedirect,
  notFound,
  RedirectType,
  ServerInsertedHTMLContext,
  registerNavigation,
  type NavigationImpl,
} from './next-navigation'
