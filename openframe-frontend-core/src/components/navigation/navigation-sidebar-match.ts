import type {
  NavigationSidebarItem,
  NavigationSidebarLocation,
  NavigationSidebarMatch,
  NavigationSidebarMatchRule,
} from '../../types/navigation';

/** `isActive: true` — the host said so, and nothing outranks it. */
const EXPLICIT_SCORE = Number.POSITIVE_INFINITY;
/** A `match` function — the host deciding outright, above every declarative rule. */
const FUNCTION_SCORE = Number.MAX_SAFE_INTEGER;

/** `/scripts/` → `/scripts`; the root stays `/`. The app exports with trailing slashes. */
function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  if (trimmed === '') return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Splits `/monitoring/?tab=policies#x` into a normalized pathname and its query. */
export function parseNavigationLocation(currentPath: string): NavigationSidebarLocation {
  const hashAt = currentPath.indexOf('#');
  const withoutHash = hashAt >= 0 ? currentPath.slice(0, hashAt) : currentPath;
  const queryAt = withoutHash.indexOf('?');
  return {
    pathname: normalizePathname(queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash),
    searchParams: new URLSearchParams(queryAt >= 0 ? withoutHash.slice(queryAt + 1) : ''),
  };
}

/** A rule written as a URL: its pathname is the prefix, every query pair is required. */
function toRule(rule: string | NavigationSidebarMatchRule): NavigationSidebarMatchRule {
  if (typeof rule !== 'string') return rule;
  const { pathname, searchParams } = parseNavigationLocation(rule);
  const query: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    query[key] = value;
  });
  return { path: pathname, query };
}

function segmentCount(pathname: string): number {
  return pathname.split('/').filter(Boolean).length;
}

/**
 * How specifically a rule matches the location, or `null` when it does not.
 * Path segments dominate, then the number of query constraints, then `exact` —
 * so `/scripts/schedules` beats `/scripts`, and `/monitoring?tab=policies`
 * beats a bare `/monitoring`.
 */
function scoreRule(rule: NavigationSidebarMatchRule, location: NavigationSidebarLocation): number | null {
  const path = normalizePathname(rule.path);
  const { pathname, searchParams } = location;
  // `/` as a prefix would match every page; it only ever means the root itself.
  const pathMatches =
    rule.exact || path === '/' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return null;

  const constraints = Object.entries(rule.query ?? {});
  for (const [key, expected] of constraints) {
    const accepted: ReadonlyArray<string | null> = Array.isArray(expected) ? expected : [expected];
    if (!accepted.includes(searchParams.get(key))) return null;
  }
  return segmentCount(path) * 1000 + constraints.length * 10 + (rule.exact ? 1 : 0);
}

function scoreMatch(match: NavigationSidebarMatch, location: NavigationSidebarLocation): number | null {
  if (typeof match === 'function') return match(location) ? FUNCTION_SCORE : null;
  // `Array.isArray` does not narrow a ReadonlyArray union, hence the casts.
  const rules = Array.isArray(match)
    ? (match as ReadonlyArray<string | NavigationSidebarMatchRule>)
    : [match as string | NavigationSidebarMatchRule];
  let best: number | null = null;
  for (const rule of rules) {
    const score = scoreRule(toRule(rule), location);
    if (score !== null && (best === null || score > best)) best = score;
  }
  return best;
}

/**
 * How strongly an entry claims the current page, or `null` for "not this one".
 * `isActive`, when the host set it, is final either way; otherwise `match` (or
 * the entry's own `path`) is checked against the location, when there is one.
 */
export function scoreNavigationItem(
  item: NavigationSidebarItem,
  location: NavigationSidebarLocation | null,
): number | null {
  if (item.isActive !== undefined) return item.isActive ? EXPLICIT_SCORE : null;
  if (!location) return null;
  const match = item.match ?? item.path;
  return match === undefined ? null : scoreMatch(match, location);
}

export interface NavigationActiveState {
  /** The ONE entry that is the current page (a child, in a grouped config), or null. */
  activeId: string | null;
  /**
   * The top-level entry with children that holds the active entry — or is it,
   * when a parent matched itself and none of its children did. The group that
   * is open by default.
   */
  groupId: string | null;
}

export interface ResolveNavigationActiveOptions {
  /** Pathname + query of the current page; without it only `isActive` counts. */
  currentPath?: string;
  /**
   * Look into `children` (one level) — the grouped variant. The flat variant
   * never draws children, so it never resolves to one either: with this off the
   * answer is `items.find(item => item.isActive)` for a config that sets
   * `isActive`, exactly as before.
   */
  includeChildren?: boolean;
}

/**
 * Exactly one active entry for the whole tree: the highest-scoring claim, the
 * deeper one on a tie (a parent the host marked active beside its active child
 * yields to the child), the first in document order after that.
 */
export function resolveNavigationActive(
  items: readonly NavigationSidebarItem[],
  { currentPath, includeChildren = false }: ResolveNavigationActiveOptions = {},
): NavigationActiveState {
  const location = currentPath === undefined ? null : parseNavigationLocation(currentPath);
  const candidates: Array<{ item: NavigationSidebarItem; depth: number; top: NavigationSidebarItem }> = [];
  for (const item of items) {
    candidates.push({ item, depth: 0, top: item });
    if (includeChildren) {
      for (const child of item.children ?? []) candidates.push({ item: child, depth: 1, top: item });
    }
  }

  let best: { id: string; score: number; depth: number; top: NavigationSidebarItem } | null = null;
  for (const { item, depth, top } of candidates) {
    const score = scoreNavigationItem(item, location);
    if (score === null) continue;
    if (!best || score > best.score || (score === best.score && depth > best.depth)) {
      best = { id: item.id, score, depth, top };
    }
  }

  if (!best) return { activeId: null, groupId: null };
  return {
    activeId: best.id,
    groupId: includeChildren && (best.top.children?.length ?? 0) > 0 ? best.top.id : null,
  };
}

/** The child a closed parent navigates to: the first one that goes somewhere. */
export function firstNavigableChild(item: NavigationSidebarItem): NavigationSidebarItem | undefined {
  return item.children?.find(child => child.path !== undefined || child.onClick !== undefined);
}
