// =============================================================================
// Shared Document Tree Builder
// =============================================================================
// Generic 3-pass algorithm for building hierarchical trees from flat records.
// Used by all doc-source DALs (openframe-docs, data-room-docs, future).

/**
 * Base interface for tree nodes. Consumers extend this with additional fields.
 */
export interface TreeNodeBase {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  sortOrder?: number
  children?: TreeNodeBase[]
}

/**
 * Format a document name for display: remove .md extension and capitalize.
 */
export function formatDocName(name: string): string {
  let displayName = name
  if (displayName.endsWith('.md')) {
    displayName = displayName.slice(0, -3)
  }
  if (displayName.toLowerCase() === 'readme') {
    return 'README'
  }
  return displayName.charAt(0).toUpperCase() + displayName.slice(1).replace(/-/g, ' ')
}

/**
 * Sort children: README first, then folders, then files — each group by sort_order then alphabetical.
 * Recurses into folder children to ensure consistent ordering at all levels.
 */
export function sortTreeChildren<TNode extends TreeNodeBase>(nodes: TNode[]): TNode[] {
  nodes.sort((a, b) => {
    const aIsReadme = a.name.toLowerCase() === 'readme' || a.name.toLowerCase() === 'readme.md'
    const bIsReadme = b.name.toLowerCase() === 'readme' || b.name.toLowerCase() === 'readme.md'
    if (aIsReadme && !bIsReadme) return -1
    if (!aIsReadme && bIsReadme) return 1

    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (a.type !== 'folder' && b.type === 'folder') return 1

    const aOrder = a.sortOrder ?? Infinity
    const bOrder = b.sortOrder ?? Infinity
    if (aOrder !== bOrder) return aOrder - bOrder

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  for (const node of nodes) {
    if (node.type === 'folder' && node.children) {
      node.children = sortTreeChildren(node.children as TNode[])
    }
  }

  return nodes
}

/**
 * Build a hierarchical document tree from a flat list of records.
 *
 * 3-pass algorithm:
 *   1. Create node map from flat records using the provided `mapFn`
 *   2. Build parent-child hierarchy using `getParentPath`
 *   3. Sort children (folders first, README, then others)
 */
export function buildDocumentTree<TNode extends TreeNodeBase, TDoc>(
  docs: TDoc[],
  mapFn: (doc: TDoc) => TNode,
  getParentPath: (doc: TDoc) => string | null,
  getPath: (doc: TDoc) => string
): TNode[] {
  const nodeMap = new Map<string, TNode>()
  const rootNodes: TNode[] = []

  for (const doc of docs) {
    const node = mapFn(doc)
    nodeMap.set(getPath(doc), node)
  }

  for (const doc of docs) {
    const node = nodeMap.get(getPath(doc))!
    let resolvedParentPath = getParentPath(doc)

    if (!resolvedParentPath) {
      const nodePath = getPath(doc)
      const lastSlash = nodePath.lastIndexOf('/')
      if (lastSlash > 0) {
        resolvedParentPath = nodePath.substring(0, lastSlash)
      }
    }

    if (resolvedParentPath) {
      const parent = nodeMap.get(resolvedParentPath)
      if (parent) {
        // Lazily initialize `children` so callers whose `mapFn` doesn't
        // pre-seed it still get a proper tree (previously a missing
        // `parent.children` silently flattened the child to the root).
        if (!parent.children) parent.children = []
        ;(parent.children as TNode[]).push(node)
      } else {
        rootNodes.push(node)
      }
    } else {
      rootNodes.push(node)
    }
  }

  return sortTreeChildren(rootNodes)
}
