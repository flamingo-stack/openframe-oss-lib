/**
 * `next/navigation` shim — environment-aware app-router hooks.
 *
 * Defaults to lightweight stubs backed by `window.location` and
 * `URLSearchParams` so lib components that read the URL work outside
 * a Next.js router shell. Next.js hosts can opt into the REAL
 * `next/navigation` exports (full client-router integration —
 * `router.replace(href, { scroll: false })`, etc.) by calling
 * {@link registerNavigation} ONCE at app init:
 *
 *   // hub: lib/embed-shim-registration.ts
 *   import {
 *     useRouter, usePathname, useSearchParams, useParams,
 *     redirect, permanentRedirect, notFound,
 *   } from 'next/navigation'
 *   import { registerNavigation } from '@flamingo-stack/openframe-frontend-core/embed-shims'
 *   registerNavigation({
 *     useRouter, usePathname, useSearchParams, useParams,
 *     redirect, permanentRedirect, notFound,
 *   })
 *
 * After registration, every exported hook in this file delegates to
 * the real implementation. Without registration, the stubs run:
 *
 *   - `useRouter()` → push/replace use `window.location.assign/replace`;
 *     back/forward use `history.back/forward`; refresh reloads; prefetch
 *     is a no-op.
 *   - `usePathname()` → returns `window.location.pathname` (popstate-
 *     subscribed so back/forward re-renders).
 *   - `useSearchParams()` → returns `URLSearchParams` view of
 *     `window.location.search` (popstate-subscribed).
 *   - `useParams()` → returns `{}` — embedders that need dynamic
 *     params should parse them from `usePathname()` themselves.
 *   - `notFound()` / `redirect()` / `permanentRedirect()` —
 *     best-effort equivalents using `window.location`.
 *
 * The fallback path subscribes to `popstate` only. Programmatic
 * `pushState`/`replaceState` does NOT fire popstate, so the fallback
 * does not auto-re-render on programmatic navigation. Embedders that
 * need that should register a real router or supply their own.
 */
'use client'
import { useEffect, useState } from 'react'

// --- Router shape — matches Next's AppRouterInstance surface enough to
// --- satisfy hub callsites that pass options like `{ scroll: false }`.
interface NavigateOptions {
  scroll?: boolean
}

interface PrefetchOptions {
  kind?: unknown
}

interface RouterStub {
  push: (href: string, options?: NavigateOptions) => void
  replace: (href: string, options?: NavigateOptions) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (href: string, options?: PrefetchOptions) => void
}

// --- Registration surface — partial so a host can register only the
// --- hooks it needs (e.g. routes that don't use redirect()).
export interface NavigationImpl {
  useRouter: () => RouterStub
  usePathname: () => string
  useSearchParams: () => URLSearchParams
  useParams: <T extends Record<string, string | string[]>>() => T
  redirect: (url: string, type?: unknown) => never
  permanentRedirect: (url: string, type?: unknown) => never
  notFound: () => never
}

let impl: Partial<NavigationImpl> = {}

/**
 * Register real `next/navigation` exports. Merges with any prior
 * registration so partial-overrides are safe. Call ONCE at app init
 * in a Next.js host.
 */
export function registerNavigation(nav: Partial<NavigationImpl>): void {
  impl = { ...impl, ...nav }
}

// --- Fallback impls ----------------------------------------------------

const noopRouter: RouterStub = {
  push: () => {},
  replace: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
  prefetch: () => {},
}

function fallbackUseRouter(): RouterStub {
  if (typeof window === 'undefined') return noopRouter
  return {
    push: (href: string) => window.location.assign(href),
    replace: (href: string) => window.location.replace(href),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => window.location.reload(),
    prefetch: () => {},
  }
}

function readLocation<T>(read: () => T, fallback: T): T {
  return typeof window === 'undefined' ? fallback : read()
}

/** Subscribes to `popstate` only. pushState/replaceState do NOT fire
 *  popstate by design — callers that mutate the URL programmatically
 *  (and want their component to re-render in response) need a real
 *  router. */
function useLocationSubscription(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onChange = () => setTick((t) => t + 1)
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return tick
}

function fallbackUsePathname(): string {
  useLocationSubscription()
  return readLocation(() => window.location.pathname, '/')
}

function fallbackUseSearchParams(): URLSearchParams {
  useLocationSubscription()
  return readLocation(
    () => new URLSearchParams(window.location.search),
    new URLSearchParams(),
  )
}

function fallbackUseParams<T extends Record<string, string | string[]>>(): T {
  return {} as T
}

function fallbackRedirect(url: string): never {
  if (typeof window !== 'undefined') window.location.assign(url)
  throw new Error(`[next-navigation shim] redirect(${url})`)
}

function fallbackPermanentRedirect(url: string): never {
  if (typeof window !== 'undefined') window.location.replace(url)
  throw new Error(`[next-navigation shim] permanentRedirect(${url})`)
}

function fallbackNotFound(): never {
  throw new Error('[next-navigation shim] notFound()')
}

// --- Public surface — each export checks the registry and falls
// --- through to the fallback. Hooks must remain hooks (no early-
// --- return-before-hook) — the registry lookup is itself synchronous
// --- and the registered impl is a hook in its own right.

export function useRouter(): RouterStub {
  return (impl.useRouter ?? fallbackUseRouter)()
}

export function usePathname(): string {
  return (impl.usePathname ?? fallbackUsePathname)()
}

export function useSearchParams(): URLSearchParams {
  return (impl.useSearchParams ?? fallbackUseSearchParams)()
}

export function useParams<T extends Record<string, string | string[]>>(): T {
  return ((impl.useParams as (() => T) | undefined) ?? fallbackUseParams)()
}

export function redirect(url: string, type?: unknown): never {
  return (impl.redirect ?? fallbackRedirect)(url, type)
}

export function permanentRedirect(url: string, type?: unknown): never {
  return (impl.permanentRedirect ?? fallbackPermanentRedirect)(url, type)
}

export function notFound(): never {
  return (impl.notFound ?? fallbackNotFound)()
}

/** Match Next's RedirectType enum surface for code that imports it. */
export const RedirectType = {
  push: 'push' as const,
  replace: 'replace' as const,
}

/** Match Next's ServerInsertedHTMLContext surface — non-functional in
 *  the embed environment but importable so consumers don't crash. */
export const ServerInsertedHTMLContext = null as any
