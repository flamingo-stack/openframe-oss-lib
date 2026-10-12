/**
 * What the browser needs settled BEFORE a `<mux-player>` mounts, and the viewer
 * identity handed to it. Importing this module prepares the page once; the file
 * player imports it ahead of the player itself.
 */

import { randomId } from '../../utils/random-id';

// -----------------------------------------------------------------------------
// Viewer identity without a cookie
// -----------------------------------------------------------------------------
//
// Mux Data keeps `mux_viewer_id` (stable viewer) and a rolling session id in a
// `muxData` cookie, 365-day expiry. That cookie rides on EVERY request to the
// origin, and its punctuation trips Cloud Armor's restricted-SQL-character
// cookie counters (CRS 942420/942421): 245 preview-DENY events in a 6-hour
// census. `disableCookies` alone stops the beacons carrying any viewer id at
// all (`viewerData = disableCookies ? {} : Ae()` in mux-embed), which would
// turn every page load into a new "unique viewer".
//
// So the identity is kept and the cookie dropped: the id lives in localStorage
// and is handed to Mux as `metadata.viewer_user_id`. No coverage is lost: Mux's
// cookie is host-only and localStorage is origin-scoped, so the two cover
// exactly the same surface.
//
// What does NOT come back: `session_id`/`session_start`, which group views into
// a 25-minute session (mux-embed derives those itself and takes none from
// outside). Per-view metrics, QoE and viewer counts are unaffected.
const MUX_VIEWER_ID_KEY = 'mux:viewer_id';

/** This browser's stable Mux viewer id; `undefined` where storage is off (Mux then counts per view). */
export function muxViewerId(): string | undefined {
  try {
    const existing = localStorage.getItem(MUX_VIEWER_ID_KEY);
    if (existing) return existing;
    const generated = randomId();
    localStorage.setItem(MUX_VIEWER_ID_KEY, generated);
    return generated;
  } catch {
    return undefined;
  }
}

/**
 * `disableCookies` stops NEW `muxData` cookies but never clears one already
 * issued, and at 365 days those browsers would keep tripping the cookie rules
 * for a year. Host-only, so no `domain` attribute: that is what Mux set.
 * Remove this once the census reads zero.
 */
function removeLegacyViewerCookie(): void {
  document.cookie = 'muxData=; path=/; max-age=0';
}

/**
 * `castable-video` (under media-chrome, under MuxPlayer) injects Google's Cast
 * sender script whenever it sees Chrome, and that script loads further ones
 * over plain HTTP, which no reasonable CSP allows: three console errors per
 * video. Its loader has one early exit, `if (globalThis.chrome?.cast) return`,
 * so `chrome.cast` is made truthy (`isAvailable: false`, for code that asks).
 * Nothing here casts; a host that ever does initialises Cast itself.
 */
function keepCastSdkOut(): void {
  const page = window as unknown as { chrome?: { cast?: unknown } };
  if (!page.chrome?.cast) page.chrome = { ...(page.chrome ?? {}), cast: { isAvailable: false } };
}

const NO_STYLE_SHEET_WARNING = 'Media Chrome: No style sheet found on style tag of';

/**
 * A player mounted inside a portal (the chat panel's dialog) is moved across
 * DOM trees before the browser gives its shadow `<style>` a sheet, and
 * media-chrome warns once per player although the sheet arrives on the next
 * paint. That one warning is dropped; every other `console.warn` passes through.
 * The player takes no option for it and the warning fires before a host can
 * reach the element.
 */
function dropNoStyleSheetWarning(): void {
  const warn = console.warn.bind(console);
  console.warn = (...args: unknown[]): void => {
    if (typeof args[0] === 'string' && args[0].startsWith(NO_STYLE_SHEET_WARNING)) return;
    warn(...args);
  };
}

/** Each preparation, and what a failure of it costs: none may stop the others or the player. */
const PREPARATIONS = [removeLegacyViewerCookie, keepCastSdkOut, dropNoStyleSheetWarning];

/** Run once per page, however many copies of this module a bundler makes. */
function prepareMuxPlayerEnvironment(): void {
  if (typeof window === 'undefined') return;
  const page = window as unknown as { __MUX_PLAYER_ENVIRONMENT_READY__?: boolean };
  if (page.__MUX_PLAYER_ENVIRONMENT_READY__) return;
  page.__MUX_PLAYER_ENVIRONMENT_READY__ = true;
  for (const prepare of PREPARATIONS) {
    try {
      prepare();
    } catch {
      // A preparation that cannot run leaves a console line or a cookie behind, never a broken player.
    }
  }
}

prepareMuxPlayerEnvironment();
