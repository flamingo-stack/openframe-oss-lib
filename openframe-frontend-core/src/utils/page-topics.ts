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
 * - A SECTION of a page is the page's path and the section's anchor
 *   (`/pricing#ai-token-rates`, `sectionTopicFor`). A section asks with it; a tag
 *   with an anchor is written for that section only, and the page's own tags
 *   cover its sections too. There is no other kind of topic.
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

/** A section anchor as topics carry it: lowercased letters, digits and `-` or `_`. */
const SECTION_ANCHOR = /^[a-z0-9][a-z0-9_-]{0,63}$/;

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

/**
 * The page's own address in the form topics are compared in (`/Help-Center/FAQs/?x` is `/help-center/faqs`), the
 * host's mount kept: what the page's topic stamp prints. Where a host mounts the hub's pages, it differs from the
 * page's topic (`pageTopicFor`), the path its quick actions and FAQs are tagged with.
 */
export function pageAddressFor(pathname: string): string {
  return normalizePath(pathname);
}

/** The topic the page at `pathname` asks with: its path, without the host's mount. */
export function pageTopicFor(pathname: string, options: PageTopicOptions = {}): string {
  const path = normalizePath(pathname);
  const base = options.basePath ? normalizePath(options.basePath) : HOME_PATH;
  if (base === HOME_PATH) return path;
  if (path === base) return HOME_PATH;
  return path.startsWith(`${base}/`) ? path.slice(base.length) : path;
}

/** The topic of a section of a page: the page's path (as `pageTopicFor` reads it) and the section's anchor. */
export function sectionTopicFor(pathname: string, section: string, options: PageTopicOptions = {}): string {
  return `${pageTopicFor(pathname, options)}#${section.trim().toLowerCase()}`;
}

/** A topic's page and its section anchor (null for a whole page). */
export function splitTopic(topic: string): { page: string; section: string | null } {
  const hash = topic.indexOf('#');
  return hash < 0 ? { page: topic, section: null } : { page: topic.slice(0, hash), section: topic.slice(hash + 1) };
}

/** A topic in its one form (`/pricing`, `/pricing#ai-token-rates`), or null when the value is not one. */
export function normalizeTopic(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!isPagePathTopic(raw)) return null;
  const { page, section } = splitTopic(raw);
  if (section === null) return pageTopicFor(page);
  const anchor = section.toLowerCase();
  return SECTION_ANCHOR.test(anchor) ? `${pageTopicFor(page)}#${anchor}` : null;
}

/** Whether a tag is a topic: every topic starts with a page's path. */
export function isPagePathTopic(tag: string): boolean {
  return tag.startsWith(HOME_PATH);
}

/** Whether a page's tag (no anchor) covers the page `path`: the path itself or a parent of it. */
function pageCovers(tagPage: string, page: string): boolean {
  if (tagPage === HOME_PATH || page === HOME_PATH) return tagPage === page;
  return page === tagPage || page.startsWith(`${tagPage}/`);
}

/**
 * Whether `tag` is written for the place `place` (a page, or a section of one): a page's tag covers that page, the
 * pages under it and all their sections; a section's tag covers that section only. A value that is not a topic (a bare
 * word: there is no other kind of topic) is written for no place and matches nothing, itself included.
 */
export function topicMatchesPath(tag: string, place: string): boolean {
  if (!isPagePathTopic(tag) || !isPagePathTopic(place)) return false;
  const t = splitTopic(tag);
  const p = splitTopic(place);
  if (t.section !== null) return t.section === p.section && t.page === p.page;
  return pageCovers(t.page, p.page);
}

/** Every tag that can be written for `place`, deepest first (a section, then its page and the pages above it): what a
 *  host queries its rows by. A value that is not a topic has none (`[]`): a host normalizes the place first. */
export function topicCandidates(place: string): string[] {
  if (!isPagePathTopic(place)) return [];
  const { page, section } = splitTopic(place);
  const pages =
    page === HOME_PATH
      ? [HOME_PATH]
      : page
          .split('/')
          .filter(Boolean)
          .map((_, i, segments) => `/${segments.slice(0, segments.length - i).join('/')}`);
  return section === null ? pages : [place, ...pages];
}

/** The deepest of `tags` written for the page at `path`, or null when none is. */
export function deepestTopic(tags: Iterable<string>, path: string): string | null {
  let best: string | null = null;
  for (const tag of tags) {
    if (topicMatchesPath(tag, path) && (best === null || tag.length > best.length)) best = tag;
  }
  return best;
}
