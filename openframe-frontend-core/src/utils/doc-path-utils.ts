/**
 * Shared document path utilities.
 * Single source of truth for path/slug operations used by all doc-source viewers
 * (knowledge base, data room, future).
 */

import { DEFAULT_FOLDER_INDEX_FILE } from './doc-tree-nav'

/**
 * Convert a document name to a URL-safe path slug.
 * Used when creating, moving, or renaming documents.
 * e.g., "Investor Thesis" → "investor-thesis"
 */
export function toDocSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

/**
 * Convert a full document path to a DOM-safe node ID.
 * Used for tree node IDs and sidebar expand/collapse state.
 * e.g., "legal/cap-table/safe.md" → "legal-cap-table-safe.md"
 */
export function pathToNodeId(path: string): string {
  return path.replace(/[\/\s]/g, '-').toLowerCase()
}

/**
 * Normalize a raw URL path from a route handler.
 * Strips folder-index suffixes (default README.md) and lowercases segments.
 * Used by both data-room and knowledge-base [...path] route handlers.
 */
export function normalizeDocPath(
  segments: string[],
  folderIndexFile: string = DEFAULT_FOLDER_INDEX_FILE,
): string {
  let docPath = segments?.join('/') || ''

  const suffix = `/${folderIndexFile}`
  if (docPath.endsWith(suffix)) docPath = docPath.slice(0, -suffix.length)
  else if (docPath === folderIndexFile) docPath = ''

  return docPath.toLowerCase()
}
