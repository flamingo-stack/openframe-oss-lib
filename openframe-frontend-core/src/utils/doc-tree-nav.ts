/**
 * Pure helpers for doc-source tree navigation — shared by client hook and RSC SSR.
 * README convention (folder-index file) is configurable but defaults to 'README.md'.
 */

import type { DocNode } from '../types/doc-source'

/**
 * Canonical folder-index filename. Single SSOT consumed by `doc-tree-nav`
 * pure helpers, `useDocumentTree` (default config), `DocSeoContent` (fallback
 * fetch path), and `multi-level-navigation`'s visual-selection logic. Stays
 * in canonical case here; consumers that do case-insensitive comparison
 * (the navigation) lowercase locally.
 */
export const DEFAULT_FOLDER_INDEX_FILE = 'README.md'

/** @deprecated Re-exported under the new name; remove after consumers migrate. */
const DEFAULT_FOLDER_INDEX = DEFAULT_FOLDER_INDEX_FILE

/**
 * Strip the folder-index filename from a path, returning the folder path.
 * For default 'README.md': 'folder/README.md' → 'folder', 'README.md' → '', 'folder/file.md' → 'folder/file.md'
 */
export function stripFolderIndexFromPath(
  path: string,
  folderIndexFile: string = DEFAULT_FOLDER_INDEX,
): string {
  const suffix = `/${folderIndexFile}`
  if (path.endsWith(suffix)) return path.slice(0, -suffix.length)
  if (path === folderIndexFile) return ''
  return path
}

export function findDocNodeByPath(path: string, nodes: DocNode[]): DocNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findDocNodeByPath(path, node.children)
      if (found) return found
    }
  }
  return null
}

/**
 * Given a node path like "folder1/subfolder2", return DOM-style node IDs for each segment
 * (accordion sidebar — matches use-document-tree).
 */
export function getDocAncestorNodeIds(nodePath: string): string[] {
  const parts = nodePath.split('/')
  const ids: string[] = []
  let current = ''
  for (const part of parts) {
    current = current ? `${current}-${part}` : part
    ids.push(current.toLowerCase())
  }
  return ids
}

/**
 * Resolve which storage path to load (matches use-document-tree content effect).
 */
export function resolveContentFetchPath(
  selectedPath: string,
  structure: DocNode[],
  folderIndexFile: string = DEFAULT_FOLDER_INDEX,
): string | null {
  if (selectedPath === '') {
    return folderIndexFile
  }
  const node = findDocNodeByPath(selectedPath, structure)
  if (node && node.type === 'folder' && !node.hasReadme) {
    return null
  }
  let pathToFetch = selectedPath
  if (node && node.type === 'folder' && node.hasReadme) {
    pathToFetch = `${selectedPath}/${folderIndexFile}`
  }
  return pathToFetch
}

export function getInitialExpandedNodeIds(cleanInitialPath: string): string[] {
  if (!cleanInitialPath) return []
  const pathForExpansion = cleanInitialPath.includes('.')
    ? cleanInitialPath.substring(0, cleanInitialPath.lastIndexOf('/'))
    : cleanInitialPath
  if (!pathForExpansion) return []
  return getDocAncestorNodeIds(pathForExpansion)
}

/**
 * When a doc source's root has no top-level folder-index file, navigate to the first
 * folder that does. Matches the historical knowledge-base default.
 */
export function getDocSourceDefaultPath(
  structure: DocNode[],
  folderIndexFile: string = DEFAULT_FOLDER_INDEX,
): string | null {
  if (!structure.length) return null
  const hasRootIndex = structure.some(
    (node) => node.type === 'file' && node.path === folderIndexFile
  )
  if (hasRootIndex) return null
  const first = structure[0]
  if (first?.type === 'folder' && first.hasReadme && first.path) {
    return first.path
  }
  return null
}
