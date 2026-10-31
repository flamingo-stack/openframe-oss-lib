/**
 * THE topic of a page is its own path: one rule for every surface that offers
 * something "for this page" (the FAQ block, its "ask the assistant" card, the
 * chat's quick actions). No host keeps a route to topic map: FAQs and quick
 * actions are tagged with the paths of the pages they are written for.
 *
 * - A page asks with its path: query and hash dropped, trailing slash dropped,
 *   lowercased, decoded (`/Blog/My-Post/?x` asks `/blog/my-post`).
 * - A host that mounts the hub's pages under a path states it (`basePath`):
 *   `/help-center/roadmap` asks `/roadmap`, the hub page it mirrors. A path
 *   outside the mount is asked as it is (`/devices`).
 * - A tag is written for a page when it is the page's path or a parent of it
 *   (`/blog` is written for `/blog` and `/blog/my-post`); `/` only for the home
 *   page. A page takes its DEEPEST matching tag (`deepestTopic`), so a record
 *   page shares its list page's topic until something is tagged for it alone.
 *
 * A zero-import leaf: a server read and the browser resolve through the same
 * functions.
 */

const HOME_PATH = '/';

/** A path segment decoded, or as written when its escapes are malformed (`%E0`): an address never throws. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** A path in the one form topics are compared in: leading slash, no trailing slash, lowercased, decoded. */
function normalizePath(pathname: string): string {
  const segments = (pathname.split(/[?#]/)[0] ?? '')
    .split('/')
    .filter(Boolean)
    .map(segment => decodeSegment(segment).toLowerCase());
  return segments.length === 0 ? HOME_PATH : `/${segments.join('/')}`;
}

export interface PageTopicOptions {
  /** Where the host mounts the hub's pages (`/help-center`): a path under it is asked without it. */
  basePath?: string;
}

/** The topic the page at `pathname` asks with: its path, without the host's mount. */
export function pageTopicFor(pathname: string, options: PageTopicOptions = {}): string {
  const path = normalizePath(pathname);
  const base = options.basePath ? normalizePath(options.basePath) : HOME_PATH;
  if (base === HOME_PATH) return path;
  if (path === base) return HOME_PATH;
  return path.startsWith(`${base}/`) ? path.slice(base.length) : path;
}

/** Whether a tag names a page (a path), as opposed to a section of a page (a word). */
export function isPagePathTopic(tag: string): boolean {
  return tag.startsWith(HOME_PATH);
}

/** Whether `tag` is written for the page at `path` (`pageTopicFor`'s answer): the path itself or a parent of it. */
export function topicMatchesPath(tag: string, path: string): boolean {
  if (!isPagePathTopic(tag)) return tag === path;
  if (tag === HOME_PATH || path === HOME_PATH) return tag === path;
  return path === tag || path.startsWith(`${tag}/`);
}

/** Every tag that can be written for the page at `path`, deepest first: what a host queries its rows by. */
export function topicCandidates(path: string): string[] {
  if (!isPagePathTopic(path) || path === HOME_PATH) return [path];
  const segments = path.split('/').filter(Boolean);
  return segments.map((_, i) => `/${segments.slice(0, segments.length - i).join('/')}`);
}

/** The deepest of `tags` written for the page at `path`, or null when none is. */
export function deepestTopic(tags: Iterable<string>, path: string): string | null {
  let best: string | null = null;
  for (const tag of tags) {
    if (topicMatchesPath(tag, path) && (best === null || tag.length > best.length)) best = tag;
  }
  return best;
}
