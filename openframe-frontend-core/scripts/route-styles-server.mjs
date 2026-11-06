/**
 * The page's stylesheet, for the root layout of an app built with `next-styles build` (`./route-styles.cjs`).
 *
 *   import { RouteStyles } from '<package>/route-styles'
 *   <body><RouteStyles />…</body>                      // once, in the root layout
 *   <RouteStyles complete />                            // pages that depend on who is signed in
 *
 * It writes the rules of the page's route into the HTML (a `<style precedence>`, which React puts in the head after
 * the app's own stylesheets) and starts the complete sheet loading after paint. The route is the page's path
 * (`usePathname` in the server render of the client part), matched against the routes the build sampled; a path no
 * route matches gets the complete sheet. The rules reach the HTML only: the client part reads them from a resolver
 * this module puts in the process, never from a prop, so they are not written again into the page's data (the RSC
 * payload a client navigation reads). In `next dev`, and in a build not made by `next-styles build`, it renders
 * nothing and the app's stylesheet holds every rule as before.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { RouteStyle } from './route-styles-client.mjs';
import markers from './route-styles-markers.cjs';

const { STYLES_DIR, MANIFEST, PLACEHOLDER, COMPLETE_PLACEHOLDER, REGISTRY_KEY } = markers;
const REGISTRY = Symbol.for(REGISTRY_KEY);

/** The build these rules belong to, and its complete sheet: written by `withRouteStyles` into the bundles. */
const BUILD = process.env.NEXT_STYLES_BUILD || '';
const FULL_URL = process.env.NEXT_STYLES_FULL_URL || '';

/** `/blog/[slug]` → a RegExp for its paths; `[...x]` takes one or more segments, `[[...x]]` none or more. */
function routePattern(route) {
  let source = '';
  let dynamic = 0;
  for (const part of route.split('/').filter(Boolean)) {
    if (/^\[\[\.\.\.[^\]]+\]\]$/.test(part)) {
      source += '(?:/.+)?';
      dynamic += 3;
    } else if (/^\[\.\.\.[^\]]+\]$/.test(part)) {
      source += '/.+';
      dynamic += 2;
    } else if (/^\[[^\]]+\]$/.test(part)) {
      source += '/[^/]+';
      dynamic += 1;
    } else {
      source += `/${part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    }
  }
  return { route, dynamic, regex: new RegExp(`^${source || '/'}$`) };
}

/**
 * The page's path as a route is written. `/index` is the home page: Next calls it that on the server (Vercel serves it
 * as the `index` function, and a page regenerated there renders with `/index` as its path), and no app route is
 * named `index` because Next answers `/index` itself.
 */
function normalize(pathname) {
  const path = `/${String(pathname || '').replace(/^\/+/, '')}`.replace(/\/+$/, '');
  return path === '' || path === '/index' ? '/' : path;
}

/**
 * The build's resolver, `(pathname, complete) → { css, fullUrl }`, read once per process. While the build
 * prerenders, it answers placeholders for the rules, which the build fills in afterwards.
 */
function createResolver() {
  // Read at run time from the server's own directory (traced in by `withRouteStyles`), never followed by the
  // bundler's file tracing.
  const dir = join(/* turbopackIgnore: true */ process.cwd(), STYLES_DIR);
  const file = join(dir, MANIFEST);
  if (!existsSync(file)) {
    throw new Error(
      `next-styles: ${file} is missing: this server was built by next-styles build and needs its ${STYLES_DIR}`,
    );
  }
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  if (manifest.pending) {
    return (_pathname, complete) =>
      complete ? { css: COMPLETE_PLACEHOLDER, fullUrl: null } : { css: PLACEHOLDER, fullUrl: FULL_URL };
  }
  if (manifest.buildId !== BUILD) {
    throw new Error(`next-styles: ${file} belongs to build ${manifest.buildId}, this server to ${BUILD}`);
  }
  const patterns = Object.keys(manifest.routes)
    .map(routePattern)
    .sort((a, b) => a.dynamic - b.dynamic || b.route.length - a.route.length);
  const sheets = new Map();
  const sheet = name => {
    if (!sheets.has(name)) sheets.set(name, readFileSync(join(dir, 'sheets', name), 'utf8'));
    return sheets.get(name);
  };
  return (pathname, complete) => {
    const path = normalize(pathname);
    const match = complete ? undefined : patterns.find(pattern => pattern.regex.test(path));
    if (!match) return { css: sheet(manifest.full), fullUrl: null };
    return { css: sheet(manifest.routes[match.route].file), fullUrl: manifest.fullUrl };
  };
}

/**
 * The page's rules: its route's sheet, or the complete sheet where no route matches its path or where `complete`
 * says the page's markup depends on who is looking (a signed-in hub), so no one page can sample its route.
 */
export function RouteStyles({ complete = false } = {}) {
  if (!BUILD) return null;
  globalThis[REGISTRY] ??= new Map();
  if (!globalThis[REGISTRY].has(BUILD)) globalThis[REGISTRY].set(BUILD, createResolver());
  return createElement(RouteStyle, { build: BUILD, complete });
}
