/**
 * Dismissal-cookie primitives — THE one implementation of "this surface was
 * dismissed", shared by every dismissible surface (announcement bar, floating
 * walkthrough video, and anything added later).
 *
 * The dismissal rule is an ID MATCH, never mere cookie presence: the store
 * holds the id of the LAST dismissed item, so publishing a NEW item re-shows
 * the surface while the old dismissal still suppresses the old item.
 *
 * TWO TIERS. The cookie is primary wherever cookies work; on a cookie-averse
 * document `localStorage` takes over under the same key. See `canUseCookies`
 * for when that is, and `fallbackStore` for why it is a fallback and not a
 * mirror.
 *
 * No `"use client"` on purpose — `isDismissedCookieValue` is pure and is used by
 * server code (the hub's root layout reads the cookie during SSR to avoid a
 * flash); the DOM-touching helpers guard on `typeof document`.
 */

import { createLocalStorageAdapter } from './local-storage-adapter';

/** One year — the COOKIE tier's horizon. The fallback tier has no expiry, so a
 *  dismissal in a native shell is permanent; adding an expiry envelope there
 *  would be inventing a second encoding to answer a question nobody has asked. */
const DISMISS_COOKIE_MAX_AGE_SECONDS = 31_536_000;

/**
 * Whether `document.cookie` actually stores anything here.
 *
 * A Document whose URL scheme is not http(s) is COOKIE-AVERSE — the HTML spec's
 * term for one where the `document.cookie` setter is a silent no-op and the
 * getter returns ''. That is where the custom-scheme shells run: Tauri serves
 * the bundle from `tauri://localhost` on macOS/Linux, Capacitor from
 * `capacitor://localhost` on iOS. Every dismissal there was dropped on write
 * and unreadable on the next mount, so the surface came back in every new
 * window and on every launch. Tauri on Windows and Capacitor on Android serve
 * http(s), were never affected, and stay on the cookie tier.
 *
 * The scheme is read directly rather than probed with a throwaway write: a lib
 * whose consumers are consent-regulated marketing sites should not set a
 * cookie, however briefly, to answer a question the URL already answers.
 * Deliberately NOT covered: cookies blocked by user or enterprise policy on an
 * http(s) origin — the surface reappears there exactly as it always has, which
 * is what someone who blocked cookies asked for.
 *
 * Read off `document.URL`, not `window.location`: averseness is a property of
 * the DOCUMENT's URL, and this file must stay usable wherever `document` is the
 * only thing the other helpers here already require. `about:blank` and
 * `about:srcdoc` are the one miss: they carry their creator's origin and are
 * served its cookies, yet land on the fallback tier here. Accepted — nothing
 * hosts this lib in one, and the cost is a re-show, not a broken surface.
 */
function canUseCookies(): boolean {
  if (typeof document === 'undefined') return false;
  return document.URL.startsWith('http:') || document.URL.startsWith('https:');
}

/**
 * The fallback tier for cookie-averse documents, keyed identically to the
 * cookie so a host needs no second key.
 *
 * A FALLBACK, never a mirror: cookies stay primary wherever they work, because
 * they are the only tier a server can read — which is what lets the hub
 * suppress a dismissed surface during SSR instead of flashing it — and writing
 * both would mean clearing cookies no longer clears a dismissal.
 */
function fallbackStore(name: string) {
  return createLocalStorageAdapter<string>({
    key: name,
    logTag: '[dismiss-cookie]',
    validate: (parsed): parsed is string => typeof parsed === 'string',
  });
}

/** THE dismissal match rule. `undefined` id (nothing active) → not dismissed. */
export function isDismissedCookieValue(cookieValue: string | undefined, id: string | undefined): boolean {
  return !!id && cookieValue === id;
}

/**
 * Read a dismissal. Returns `undefined` when absent OR unreadable — one
 * guarantee with two causes: a cookie with bad percent-encoding, where
 * `decodeURIComponent` throws `URIError`, and a fallback value that is not the
 * JSON string it should be, where the adapter swallows the parse failure.
 * Callers run this inside reveal paths where an uncaught throw would hide the
 * surface permanently, so failing open — treated as not-dismissed — is always
 * the safe side.
 */
export function readDismissCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  if (!canUseCookies()) return fallbackStore(name).load() ?? undefined;
  const match = document.cookie.split('; ').find(row => row.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

/** Persist a dismissal. */
export function writeDismissCookie(name: string, id: string): void {
  if (typeof document === 'undefined') return;
  if (!canUseCookies()) {
    fallbackStore(name).save(id);
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(id)}; path=/; max-age=${DISMISS_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/**
 * Clear a dismissal (test/story helper).
 *
 * BOTH tiers, unconditionally — the tier check governs writes, not removal.
 * Clearing writes nothing and cannot resurrect a dismissal, so it carries none
 * of the reasons the write path commits to one tier, and a clear that leaves
 * the other tier holding a value is a lie.
 *
 * NOT for a shell that changes the scheme it serves under: that is an origin
 * change, so the old tier moves to a storage bucket no code in the new origin
 * can reach — `clear` included.
 */
export function clearDismissCookie(name: string): void {
  if (typeof document === 'undefined') return;
  fallbackStore(name).clear();
  document.cookie = `${name}=; path=/; max-age=0`;
}
