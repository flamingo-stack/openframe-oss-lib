/**
 * Thin JSON-typed Web-Storage adapter (localStorage or sessionStorage).
 *
 * Centralizes the SSR-guard + try/catch + silent quota-failure pattern
 * that every per-feature storage util would otherwise re-implement.
 *
 * Optional `namespace` prefix supports platform / user partitioning —
 * the resolver runs lazily at call time so the namespace can vary across
 * the lifetime of the page (e.g. proxy-auth switches user, which switches
 * the key suffix).
 *
 * Backend selection (`backend: 'local' | 'session'`):
 *   - `'local'` (default): persists across browser sessions. Use for
 *     UI state, chat history metadata, feature-flag opt-ins.
 *   - `'session'`: cleared when the tab closes. Use for ANY auth-adjacent
 *     value (bearer tokens, act-as identity, proxy credentials). Reduces
 *     the XSS-exfiltration attack window from "indefinite" to "until tab
 *     close" without losing per-session ergonomics.
 */

export type WebStorageBackend = 'local' | 'session'

export interface LocalStorageAdapter<T> {
  load(): T | null
  save(value: T): void
  clear(): void
  /** Resolved storage key for the current call. Useful for tests. */
  resolveKey(): string
}

export interface LocalStorageAdapterOptions<T> {
  /** Base storage key. Combined with `namespace()` when provided. */
  key: string
  /** Optional dynamic namespace prefix appended via `.` separator.
   *  Called on EVERY read/write so the key can vary across the page
   *  lifetime (e.g. when the platform or user identity changes). */
  namespace?: () => string | null | undefined
  /** Runtime shape check. Falsey return → `load()` yields null. */
  validate?: (parsed: unknown) => parsed is T
  /** Diagnostic prefix written to `console.warn` on parse / write
   *  failures. Defaults to `'[local-storage]'`. */
  logTag?: string
  /** Which Web-Storage backend to use. Defaults to `'local'`. Pass
   *  `'session'` for anything auth-adjacent so the value evaporates
   *  when the tab closes. */
  backend?: WebStorageBackend
}

function getStorage(backend: WebStorageBackend): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return backend === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    // Some sandboxed contexts (Safari private mode older versions,
    // strict CSP) throw on storage access — treat as unavailable.
    return null
  }
}

export function createLocalStorageAdapter<T>(
  options: LocalStorageAdapterOptions<T>,
): LocalStorageAdapter<T> {
  const tag = options.logTag ?? '[local-storage]'
  const backend: WebStorageBackend = options.backend ?? 'local'
  const resolveKey = (): string => {
    const ns = options.namespace?.()
    return ns ? `${ns}.${options.key}` : options.key
  }

  return {
    resolveKey,
    load() {
      const storage = getStorage(backend)
      if (!storage) return null
      try {
        const raw = storage.getItem(resolveKey())
        if (!raw) return null
        const parsed = JSON.parse(raw) as unknown
        if (options.validate && !options.validate(parsed)) return null
        return parsed as T
      } catch (err) {
        console.warn(`${tag} parse failed for key ${resolveKey()}:`, err)
        return null
      }
    },
    save(value: T) {
      const storage = getStorage(backend)
      if (!storage) return
      try {
        storage.setItem(resolveKey(), JSON.stringify(value))
      } catch (err) {
        console.warn(`${tag} write failed for key ${resolveKey()}:`, err)
      }
    },
    clear() {
      const storage = getStorage(backend)
      if (!storage) return
      try {
        storage.removeItem(resolveKey())
      } catch (err) {
        console.warn(`${tag} clear failed for key ${resolveKey()}:`, err)
      }
    },
  }
}
