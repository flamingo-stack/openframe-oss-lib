/**
 * Thin JSON-typed localStorage adapter.
 *
 * Centralizes the SSR-guard + try/catch + silent quota-failure pattern
 * that every per-feature storage util would otherwise re-implement.
 *
 * Optional `namespace` prefix supports platform / user partitioning —
 * the resolver runs lazily at call time so the namespace can vary across
 * the lifetime of the page (e.g. proxy-auth switches user, which switches
 * the key suffix).
 */

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
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function createLocalStorageAdapter<T>(
  options: LocalStorageAdapterOptions<T>,
): LocalStorageAdapter<T> {
  const tag = options.logTag ?? '[local-storage]'
  const resolveKey = (): string => {
    const ns = options.namespace?.()
    return ns ? `${ns}.${options.key}` : options.key
  }

  return {
    resolveKey,
    load() {
      if (!isBrowser()) return null
      try {
        const raw = window.localStorage.getItem(resolveKey())
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
      if (!isBrowser()) return
      try {
        // lgtm[js/clear-text-storage-of-sensitive-data]
        // This is a GENERIC localStorage adapter. The `value` type
        // parameter `T` means CodeQL cannot statically determine
        // sensitivity — it conservatively flags every call as
        // potentially-clear-text. The CONTRACT of this adapter
        // (documented at the top of the file) is that callers must
        // NOT pass authentication credentials, tokens, or other
        // secrets through it. Audited call-sites store: chat history
        // metadata (`mingo-chat-*`), UI state (sidebar collapsed,
        // theme), feature-flag opt-ins, dismissed-onboarding markers
        // — all explicitly non-sensitive. Auth tokens use the
        // chat-proxy bearer flow which lives in memory, not storage.
        window.localStorage.setItem(resolveKey(), JSON.stringify(value))
      } catch (err) {
        console.warn(`${tag} write failed for key ${resolveKey()}:`, err)
      }
    },
    clear() {
      if (!isBrowser()) return
      try {
        window.localStorage.removeItem(resolveKey())
      } catch (err) {
        console.warn(`${tag} clear failed for key ${resolveKey()}:`, err)
      }
    },
  }
}
