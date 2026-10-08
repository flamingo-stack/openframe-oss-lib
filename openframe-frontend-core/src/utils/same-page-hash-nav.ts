import { findAnchorElementByNormalizedId } from './anchor-id';
import { scrollElementIntoView } from './scroll-into-view';

/** Pages with a section-nav STRIP on top of the global hub header
 *  (dev-center roadmap/delivery/tickets, FAQ category-pill nav).
 *  Anchor lands BELOW both layers. */
export const STICKY_HEADER_OFFSET_PX = 96;

/** Pages with only the global hub header (docs, blog, vendor detail).
 *  Anchor lands BELOW the header bar. */
export const HUB_HEADER_OFFSET_PX = 80;

/**
 * Take only the FIRST hash segment from a fragment that may contain extra
 * `#` characters. `'' → ''`, `'#a' → '#a'`, `'#a#b' → '#a'`.
 *
 * No real DOM id contains `#`, so a multi-fragment hash is always a bug at
 * the composer site; `navigateSamePageHash` + `useScrollToHash` both call
 * this so URL bar and `getElementById` stay in sync.
 */
export function normalizeHashFragment(hash: string): string {
  if (!hash) return '';
  const second = hash.indexOf('#', 1);
  return second < 0 ? hash : hash.slice(0, second);
}

/**
 * Resolve the DOM element a hash fragment id points at — THE hash resolver;
 * `navigateSamePageHash`, `useScrollToHash` and the markdown link renderer
 * all go through this one, so a fragment that resolves for a deep link
 * resolves for an in-body click too.
 *
 * Three passes, cheapest first:
 *   1. the raw id (ordinary anchors — the overwhelming common case);
 *   2. the percent-decoded form — href composers like `buildTicketOpenHref`
 *      encode the id into the fragment while rows render the raw id, so
 *      `#ticket-a%2Fb` must still find `id="ticket-a/b"`. A malformed escape
 *      sequence just falls through;
 *   3. a NORMALIZED match against the document's headings — doc bodies are
 *      authored on GitHub, whose slugger keeps the hyphen left behind by a
 *      stripped emoji (`## 📚 Table of Contents` → `#-table-of-contents`)
 *      while our ids trim it. Without this every in-body TOC link in every
 *      GitHub-authored doc resolves to nothing and clicking one does nothing.
 *      See `utils/anchor-id`.
 */
export function getHashTargetElement(id: string): HTMLElement | null {
  if (!id) return null;
  const direct = document.getElementById(id);
  if (direct) return direct;

  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
    if (decoded !== id) {
      const decodedEl = document.getElementById(decoded);
      if (decodedEl) return decodedEl;
    }
  } catch {
    // malformed escape — the raw lookup above already covered it
    decoded = id;
  }

  return findAnchorElementByNormalizedId(decoded, document);
}

/**
 * Fired on `window` after {@link replaceLocationHash} changed the hash. NOT
 * `hashchange`: a listener of this event follows the hash as STATE (which tab
 * is open, `useLocationHash`); a listener of `hashchange` treats it as a
 * NAVIGATION and scrolls (`useScrollToHash`). A scroll spy that keeps the URL
 * on the section being read must reach the first and never the second.
 */
export const LOCATION_HASH_SYNC_EVENT = 'locationhashsync';

/** Marks, on an element inside a section, the child anchor a scroll spy writes for that section (see `useScrollSpy`). */
export const ACTIVE_ANCHOR_ATTRIBUTE = 'data-active-anchor';

/** The key, in the history entry's state, of the hash {@link replaceLocationHash} last gave that entry. */
const HASH_SYNC_STATE_KEY = '__hashSync';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Point the URL's hash at `id` (or clear it) to say where the reader IS, as
 * opposed to sending them somewhere: no history entry (`replaceState`), no
 * `hashchange`, no scroll. THE writer for a scroll spy's hash and for a tab
 * that names itself in the URL. State followers hear
 * {@link LOCATION_HASH_SYNC_EVENT}.
 *
 * The hash is also noted in the history ENTRY's state (beside whatever the
 * host router keeps there), which survives a reload and comes back on back
 * and forward: {@link isScrollSyncedHash}. For such an entry the hash only
 * mirrors a scroll position the browser restores by itself, so
 * `useScrollToHash` does not scroll to it again. Any navigation writes its own
 * state and drops the note.
 */
export function replaceLocationHash(id: string | null): void {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  const next = id ? `#${id}` : '';
  const state: unknown = window.history.state;
  const noted = isRecord(state) ? state[HASH_SYNC_STATE_KEY] : undefined;
  if (hash === next && (noted === next || !next)) return;
  window.history.replaceState(
    { ...(isRecord(state) ? state : {}), [HASH_SYNC_STATE_KEY]: next },
    '',
    `${pathname}${search}${next}`,
  );
  if (hash !== next) window.dispatchEvent(new Event(LOCATION_HASH_SYNC_EVENT));
}

/**
 * Whether the hash in the URL was put there by {@link replaceLocationHash}
 * (the reader scrolled or opened a tab) rather than by a navigation. False
 * with no hash, on a fresh visit, and once any navigation rewrote the entry.
 */
export function isScrollSyncedHash(): boolean {
  if (typeof window === 'undefined' || !window.location.hash) return false;
  const state: unknown = window.history.state;
  return isRecord(state) && state[HASH_SYNC_STATE_KEY] === window.location.hash;
}

export interface NavigateSamePageHashOptions {
  /** Pixels to subtract for sticky chrome. */
  headerOffset?: number;
  /** `'push'` (default) — new history entry; `'replace'` — overwrite
   *  current entry (use for TOC-style in-page navigators). */
  history?: 'push' | 'replace';
}

/**
 * Same-page hash navigation primitive: pushState + synthetic `hashchange`
 * + anchoring-proof smooth scroll. Replaces `router.push` for hash CTAs
 * (Next.js suppresses smooth-scroll during navigation; `router.push` on
 * an exact-URL match is a no-op). Returns `true` when the helper claimed
 * the nav (same pathname + search); `false` for cross-page targets so
 * callers fall through to `router.push`.
 *
 * `target` accepts an origin-stripped path (`/x#anchor`) or a bare hash
 * (`#anchor`); bare-hash callers don't need to reconstruct `pathname +
 * search` themselves.
 */
export function navigateSamePageHash(target: string, options: NavigateSamePageHashOptions = {}): boolean {
  if (typeof window === 'undefined') return false;
  const { headerOffset = 0, history: historyMode = 'push' } = options;
  const normalizedTarget = target.startsWith('#') ? window.location.pathname + window.location.search + target : target;
  // `new URL(absoluteUrl, base)` ignores `base` per RFC 3986; an absolute
  // cross-origin target sharing pathname/search would otherwise pass the
  // check below and trip pushState's same-origin enforcement. Parse with
  // an explicit base so malformed inputs cleanly fall through.
  let url: URL;
  try {
    url = new URL(normalizedTarget, window.location.href);
  } catch {
    return false;
  }
  if (
    url.origin !== window.location.origin ||
    url.pathname !== window.location.pathname ||
    url.search !== window.location.search
  ) {
    return false;
  }
  const current = window.location.pathname + window.location.search + window.location.hash;
  // Heal a malformed multi-fragment hash so the URL bar is clean and
  // `getElementById` resolves. Dev-warn fingers the upstream composer.
  const normalizedHash = normalizeHashFragment(url.hash);
  if (process.env.NODE_ENV === 'development' && normalizedHash !== url.hash) {
    console.warn(
      `[navigateSamePageHash] malformed fragment "${url.hash}" → normalizing to "${normalizedHash}". Fix the upstream composer.`,
    );
  }
  const next = url.pathname + url.search + normalizedHash;
  const id = normalizedHash && normalizedHash !== '#' ? normalizedHash.slice(1) : '';
  // Hash-less targets are only ours on an EXACT URL re-click.
  if (!id && next !== current) return false;
  if (next !== current) {
    const oldURL = window.location.href;
    if (historyMode === 'replace') {
      window.history.replaceState(null, '', next);
    } else {
      window.history.pushState(null, '', next);
    }
    // Synthetic `hashchange` — `pushState` doesn't fire it (HTML spec),
    // so URL-hash-bound listeners (FAQ auto-expand, etc.) wouldn't react.
    window.dispatchEvent(
      new HashChangeEvent('hashchange', {
        oldURL,
        newURL: window.location.href,
      }),
    );
  }
  const el = id ? getHashTargetElement(id) : null;
  if (id && !el && process.env.NODE_ENV === 'development') {
    console.warn(`[navigateSamePageHash] anchor "#${id}" not found — scrolling to top.`);
  }
  // Missing anchor → tween to page top. `documentElement` is at 0 by
  // definition, so one tween covers both branches.
  scrollElementIntoView(el ?? document.documentElement, {
    behavior: 'smooth',
    headerOffset,
  });
  return true;
}
