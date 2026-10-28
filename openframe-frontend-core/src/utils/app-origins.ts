import { readRegisteredAdapter, subscribeRegisteredAdapter } from './embed-auth-adapter-registry';

/**
 * Where the app loads from: the page, and the origins the host sanctions in
 * `EmbedAuthAdapter.allowedOrigins` (the gateway of a native shell, whose page
 * origin is `capacitor://` / `tauri://`). Untrusted markdown may load media
 * only from here; `embedAuthedFetch` sends the bearer only here.
 */
export interface AppOrigins {
  /** The page's root URL (`https://host/`, `capacitor://localhost/`); `null` on the server, where there is no page. */
  readonly pageUrl: string | null;
  readonly allowedOrigins: readonly string[];
}

/** The server's answer, and the first one a hydrating client gives: only relative URLs belong to the app. */
export const SERVER_APP_ORIGINS: AppOrigins = Object.freeze({ pageUrl: null, allowedOrigins: Object.freeze([]) });

/** Base relative URLs resolve against without a page: only a relative URL lands on it. */
const SERVER_PAGE_URL = 'http://app.invalid/';

let snapshot: AppOrigins = SERVER_APP_ORIGINS;

/**
 * The app's origins now. Same object until they change, so it can be a
 * `useSyncExternalStore` snapshot (`subscribeAppOrigins` reports the change).
 */
export function readAppOrigins(): AppOrigins {
  if (typeof window === 'undefined') return SERVER_APP_ORIGINS;
  // The page's root, not its full URL: only the origin decides, and a snapshot
  // that changed with every `?tab=` would re-parse every markdown body on the
  // page. Parsed from `href` rather than read from `window.location.origin`:
  // tests mock `window.location` as a plain object without an `origin` field.
  let pageUrl: string;
  try {
    pageUrl = new URL('/', window.location.href).href;
  } catch {
    return SERVER_APP_ORIGINS;
  }
  const allowedOrigins = readRegisteredAdapter<{ allowedOrigins?: readonly string[] }>()?.allowedOrigins ?? [];
  if (
    snapshot.pageUrl !== pageUrl ||
    snapshot.allowedOrigins.length !== allowedOrigins.length ||
    snapshot.allowedOrigins.some((origin, i) => origin !== allowedOrigins[i])
  ) {
    snapshot = { pageUrl, allowedOrigins: [...allowedOrigins] };
  }
  return snapshot;
}

/** Called when a host registers, replaces or clears its auth adapter, which can change `allowedOrigins`. */
export const subscribeAppOrigins: (listener: () => void) => () => void = subscribeRegisteredAdapter;

/**
 * `url` resolved against the page when it belongs to the app, otherwise `null`.
 *
 * The page match compares scheme and host instead of `URL.origin`, which is
 * `"null"` for a `capacitor://` page.
 */
export function resolveAppOriginUrl(url: string, origins: AppOrigins = readAppOrigins()): URL | null {
  let page: URL;
  let target: URL;
  try {
    page = new URL(origins.pageUrl ?? SERVER_PAGE_URL);
    target = new URL(url, page);
  } catch {
    return null;
  }
  if (target.protocol === page.protocol && target.host === page.host) return target;
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
  return origins.allowedOrigins.includes(target.origin) ? target : null;
}

/**
 * Whether `url` loads from the app itself rather than from a third party.
 * Untrusted markdown may only load media from here: a third-party `<img src>`
 * is a request the content's author receives, with whatever the URL carries.
 * Pass `origins` to decide against a snapshot (a render that must give the
 * server's answer while it hydrates); it defaults to the app's origins now.
 */
export function isAppOriginUrl(url: string, origins?: AppOrigins): boolean {
  return resolveAppOriginUrl(url, origins) !== null;
}

/**
 * `url` as an absolute http(s) URL against `origins`' page, for a stand-in to
 * name its host; `null` when it is not http(s).
 */
export function absoluteHttpUrl(url: string, origins: AppOrigins = readAppOrigins()): string | null {
  try {
    const resolved = new URL(url.trim(), origins.pageUrl ?? SERVER_PAGE_URL);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null;
  } catch {
    return null;
  }
}
