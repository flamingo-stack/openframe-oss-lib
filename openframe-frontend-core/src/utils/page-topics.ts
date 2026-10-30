/**
 * THE topic of a page, read from its address: one rule for every surface that
 * offers something "for this page" (the FAQ block, its "ask the assistant"
 * card, the chat's quick actions). The address is the only source: no surface
 * takes a topic as a prop, so a page's FAQ and its chat can never disagree.
 *
 * The HOST declares its map once (`PageTopicsProvider topics`), route to topic:
 *
 * - `'/pricing': 'pricing'`: the page and every page under it (`/pricing/x`).
 * - `'/blog/[slug]': 'blog_post'`: a `[name]` segment matches any one segment,
 *   so a record page can have its own topic beside its list page's.
 * - `'/help-center/legal/[docType]': '[docType]'`: a topic written as a
 *   segment's name is that segment's value.
 *
 * The most specific route wins (more segments, then fewer `[name]` segments);
 * `/` names the home page only. A page no route covers has no topic.
 *
 * A zero-import leaf: a server read and the browser resolve through the same
 * function.
 */

/** The host's routes, each to the topic of the pages it covers. */
export type PageTopics = Readonly<Record<string, string>>;

const HOME_ROUTE = '/';
const PARAM_RE = /^\[([^\]/]+)\]$/;

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** A path segment decoded, or as written when its escapes are malformed (`%E0`): an address never throws. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The values of the route's `[name]` segments for `pathname`, or null when the route does not cover it. */
function matchRoute(route: string[], path: string[]): Record<string, string> | null {
  if (path.length < route.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < route.length; i += 1) {
    const param = PARAM_RE.exec(route[i]);
    if (param) params[param[1]] = decodeSegment(path[i]);
    else if (route[i] !== path[i]) return null;
  }
  return params;
}

/** Most specific first: more segments, then fewer `[name]` segments. */
function bySpecificity(a: string[], b: string[]): number {
  if (a.length !== b.length) return b.length - a.length;
  const params = (route: string[]) => route.filter(segment => PARAM_RE.test(segment)).length;
  return params(a) - params(b);
}

/** The topic of the page at `pathname` under `topics`, or null when no route covers it. */
export function pageTopicFor(pathname: string, topics: PageTopics): string | null {
  const path = segmentsOf(pathname.split(/[?#]/)[0] ?? '');
  if (path.length === 0) return topics[HOME_ROUTE] ?? null;
  const routes = Object.keys(topics)
    .filter(route => route !== HOME_ROUTE)
    .map(route => ({ route, segments: segmentsOf(route) }))
    .sort((a, b) => bySpecificity(a.segments, b.segments));
  for (const { route, segments } of routes) {
    const params = matchRoute(segments, path);
    if (!params) continue;
    const topic = topics[route];
    const named = PARAM_RE.exec(topic);
    return named ? (params[named[1]] ?? null) : topic;
  }
  return null;
}
