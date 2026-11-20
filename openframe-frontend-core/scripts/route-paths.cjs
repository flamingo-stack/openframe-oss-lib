/**
 * THE Next.js app-router rule for which files are pages and what paths a route folder answers, stated once:
 * `style-sources` reads it to know which pages a build serves, and a host reads it to name an app's pages from its
 * file list (the hub's topic suggestions read the OpenFrame app's `page.tsx` files from its code graph). A leaf with
 * no imports, so a server bundle can carry it without reaching the build tool.
 */

/** A page file: `page.tsx`, `page.js`, … */
const PAGE_FILE = /^page\.[cm]?[jt]sx?$/;

/** Whether a file name is a page. */
function isPageFile(name) {
  return PAGE_FILE.test(name);
}

/** Whether a folder is private (`_lib`): Next routes nothing under it. */
function isPrivateSegment(name) {
  return name.startsWith('_');
}

/**
 * The paths a route folder answers, from its folder names under the app directory: route groups (`(app)`) and
 * parallel slots (`@modal`) spell nothing. A sample path with each dynamic segment filled ('/blog/x'), and for a
 * dynamic route the static part before its first dynamic segment ('/blog', '/' for `(landing)/[slug]`), because a
 * dynamic route serves every path under it and a list of exact paths knows none of them as '/x'.
 */
function routeSegmentPaths(segments) {
  const routed = segments.filter(segment => segment && !/^\(.*\)$/.test(segment) && !segment.startsWith('@'));
  const firstDynamic = routed.findIndex(segment => segment.startsWith('['));
  const sample = `/${routed.map(segment => (segment.startsWith('[') ? 'x' : segment)).join('/')}`;
  if (firstDynamic === -1) return [sample];
  return [sample, `/${routed.slice(0, firstDynamic).join('/')}`];
}

module.exports = { isPageFile, isPrivateSegment, routeSegmentPaths };
