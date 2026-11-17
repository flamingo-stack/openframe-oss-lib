/**
 * The names `next-styles build` and `RouteStyles` agree on, stated once: the build writes them
 * (`./route-styles.cjs`, `./next-styles.cjs`) and the server and client parts read them
 * (`./route-styles-server.mjs`, `./route-styles-client.mjs`). A leaf with no imports, so the app's server and
 * browser bundles can carry it without reaching the build tool.
 */
module.exports = {
  /** Where `next-styles build` keeps the build's route sheets (the app's directory), and its files there. */
  STYLES_DIR: '.next-styles',
  BUILD_INFO: 'build.json',
  MANIFEST: 'manifest.json',
  /** What a prerendered page's route `<style>` holds until the build fills it with the route's rules. */
  PLACEHOLDER: '/*next-styles:route*/',
  /** What a page that carries the complete sheet (`RouteStyles complete`) holds until the build fills it. */
  COMPLETE_PLACEHOLDER: '/*next-styles:complete*/',
  /** The process-wide key the server part registers its resolver under for the client part's server render. */
  REGISTRY_KEY: 'flamingo.next-styles',
  /** The complete sheet, built before `next build` (its hash names the build), in `STYLES_DIR`. */
  COMPLETE_SOURCE: 'complete.css',
  /** The complete sheet of the build that is live, under a name every build writes (`fallbackSheetUrl`). */
  FULL_ALIAS: 'full.css',
  fallbackSheetUrl,
};

/**
 * Where a page loads the complete sheet when its own is gone: the live build's, by the name every build writes
 * (`full.css`), keyed by the missing build (`?from=`) so a cache never answers one page with another's copy, and
 * keeping the address's own query (`dpl`). A page a previous deployment served can ask for its sheet after that
 * deployment's files are gone (a rolling update on a host that keeps only the live build's files); the live build's
 * sheet holds the rules the page needs unless they were removed. Empty for an address that names no sheet.
 *
 * ES5 and self-contained: the inline loader `RouteStyle` writes into the page carries this function's source.
 */
function fallbackSheetUrl(url) {
  const q = url.indexOf('?');
  const base = q < 0 ? url : url.slice(0, q);
  const rest = q < 0 ? '' : '&' + url.slice(q + 1);
  const m = base.match(/full-([^/]+)\.css$/);
  return m ? base.slice(0, base.length - m[0].length) + 'full.css?from=' + m[1] + rest : '';
}
