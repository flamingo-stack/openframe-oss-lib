/**
 * Shared document path utilities.
 * Single source of truth for path/slug operations used by all doc-source viewers
 * (knowledge base, data room, future), and for the two ways a doc's tree path is carried in a route: stripped for an
 * embedder's own docs route (`sanitizeDocPath`), and encoded segment by segment in a viewer's address
 * (`docRoutePath`, read back by `docTreePathOfRoute`). The hub's doc mappers and the lib's resolvers import them from
 * here.
 */

import { DEFAULT_FOLDER_INDEX_FILE } from './doc-tree-nav';

/**
 * Convert a document name to a URL-safe path slug.
 * Used when creating, moving, or renaming documents.
 * e.g., "Investor Thesis" → "investor-thesis"
 */
export function toDocSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

/**
 * Convert a full document path to a DOM-safe node ID.
 * Used for tree node IDs and sidebar expand/collapse state.
 * e.g., "legal/cap-table/safe.md" → "legal-cap-table-safe.md"
 */
export function pathToNodeId(path: string): string {
  return path.replace(/[/\s]/g, '-').toLowerCase();
}

/**
 * Normalize a raw URL path from a route handler.
 * Strips folder-index suffixes (default README.md) and lowercases segments.
 * Used by both data-room and knowledge-base [...path] route handlers.
 */
export function normalizeDocPath(segments: string[], folderIndexFile: string = DEFAULT_FOLDER_INDEX_FILE): string {
  // Lowercase BOTH sides BEFORE comparison so paths from URL segments
  // (`readme.md`) and the canonical folder-index constant (`README.md`)
  // strip uniformly. Lowercasing only at the end (the previous shape) left
  // lowercase URL inputs unstripped → bogus content lookups.
  const lowerPath = (segments?.join('/') || '').toLowerCase();
  const lowerIndex = folderIndexFile.toLowerCase();

  const suffix = `/${lowerIndex}`;
  if (lowerPath.endsWith(suffix)) return lowerPath.slice(0, -suffix.length);
  if (lowerPath === lowerIndex) return '';
  return lowerPath;
}

/** A doc's tree path in the form a route may hold: alphanumerics, slash, dash, dot and underscore, everything else
 *  stripped, and no `.`, `..` or empty segment, so the path stays inside the docs tree. Defends against a hostile row
 *  holding a query string, an injection or a path that climbs out of the tree. */
export function sanitizeDocPath(path: string): string {
  return (path || '')
    .replace(/[^a-zA-Z0-9/_\-.]/g, '')
    .split('/')
    .filter(segment => segment !== '' && segment !== '.' && segment !== '..')
    .join('/');
}

/** A path segment as an address carries it: `encodeURI`, the exact inverse of the `decodeURI` that
 *  `docTreePathOfRoute` reads it back with (`encodeURIComponent` would leave `@ & + , : = $ ;` encoded there, and the
 *  document would miss its tree node). `?` and `#` would start a query or a fragment, so they are written out too. */
function encodeDocPathSegment(segment: string): string {
  return encodeURI(segment).replace(/[?#]/g, char => encodeURIComponent(char));
}

/**
 * `/a/b` from `a`, `/a/`, `a/b/`: a viewer route and a doc's tree path joined into the doc's address, with no regex (a
 * slash-trimming regex is CodeQL's js/polynomial-redos). A doc's path is data: each segment is encoded, and one that
 * would climb out of the route goes.
 */
export function docRoutePath(...parts: string[]): string {
  const segments = parts
    .flatMap(part => part.split('/'))
    .filter(segment => segment && segment !== '.' && segment !== '..');
  return `/${segments.map(encodeDocPathSegment).join('/')}`;
}

/** The tree path a route's tail names (`docRoutePath`'s inverse): no query or fragment, and decoded as the tree keys it. */
export function docTreePathOfRoute(tail: string): string {
  const path = tail.split(/[?#]/, 1)[0];
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}
