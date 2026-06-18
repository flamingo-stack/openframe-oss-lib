"use client"

import { ChevronRight, ChevronDown, ChevronUp, FileText, Folder, FolderOpen } from 'lucide-react'
import { cn } from '../../utils/cn'
import { DEFAULT_FOLDER_INDEX_FILE as CANONICAL_FOLDER_INDEX_FILE } from '../../utils/doc-tree-nav'

export interface NavigationNode {
  id: string
  name: string
  path: string
  type: 'file' | 'folder'
  hasReadme?: boolean
  children?: NavigationNode[]
  slug?: string
  // Mirror DocNode's extra optional fields so a DocNode tree is structurally
  // assignable to NavigationNode[] without an `as` cast. NavigationNode
  // intentionally never reads these — they're carried for type-compat only.
  documentType?: 'markdown' | 'pdf' | 'google_sheet' | 'figma' | 'file'
  sortOrder?: number
}

interface MultiLevelNavigationProps {
  nodes: NavigationNode[]
  selectedPath: string
  expandedNodes: Set<string>
  onNodeClick: (node: NavigationNode) => void
  onToggleExpand?: (nodeId: string) => void
  isLoading?: boolean
  className?: string
  /** Folder-index filename (default `'README.md'`, case-insensitive). When the
   *  selectedPath is a folder with this file, the visual ribbon moves to the
   *  child file. */
  folderIndexFile?: string
}

// SSOT lives in `doc-tree-nav` (canonical case `'README.md'`). The visual
// comparator below lowercases both sides, so re-exporting the canonical
// constant under the same local name preserves call-site syntax without
// drifting from the SSOT.
const DEFAULT_FOLDER_INDEX_FILE = CANONICAL_FOLDER_INDEX_FILE

/**
 * Compute the visual "selected" state for a navigation node.
 *
 * Folder-with-README convention: when `selectedPath` is a folder that has a
 * README, the FOLDER doesn't get the ribbon — its README child does. The folder
 * is just a container; the README is the actual document being viewed.
 *
 * Mirror case: a README file whose parent folder is the `selectedPath` gets the
 * visual selection ribbon (implicit). This handles both the auto-select-first-
 * folder landing path AND the user-clicks-folder case.
 */
function isNodeVisuallySelected(
  node: NavigationNode,
  selectedPath: string,
  folderIndexFile: string = DEFAULT_FOLDER_INDEX_FILE,
): boolean {
  const FOLDER_INDEX_FILE = folderIndexFile.toLowerCase()
  // Path comparisons keyed on `node.path` (raw, includes `.md`). Do NOT use
  // `node.name` — the tree-builder runs it through `formatDocName` which strips
  // the `.md` extension, so `node.name.toLowerCase() === 'readme.md'` is always
  // false.
  if (selectedPath === node.path) {
    // Explicit match — but folder-with-README defers to its README child.
    return !(node.type === 'folder' && node.hasReadme)
  }
  if (node.type !== 'file') return false
  const pathLower = node.path.toLowerCase()
  // Implicit: README child whose parent folder is the selectedPath.
  if (
    selectedPath !== '' &&
    pathLower === `${selectedPath.toLowerCase()}/${FOLDER_INDEX_FILE}`
  ) {
    return true
  }
  // Implicit: ROOT README on the landing page (selectedPath === '' means
  // "no explicit doc selected" — the viewer falls back to the root folder-
  // index file, so that file IS the active document).
  if (selectedPath === '' && pathLower === FOLDER_INDEX_FILE) {
    return true
  }
  return false
}

export function MultiLevelNavigation({
  nodes,
  selectedPath,
  expandedNodes,
  onNodeClick,
  onToggleExpand,
  isLoading,
  className,
  folderIndexFile = DEFAULT_FOLDER_INDEX_FILE,
}: MultiLevelNavigationProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3 bg-ods-skeleton rounded-lg animate-pulse h-12" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)} role="list" aria-label="Navigation list">
      {nodes.map(node => (
        <NavigationItem
          key={node.id}
          node={node}
          selectedPath={selectedPath}
          expandedNodes={expandedNodes}
          onNodeClick={onNodeClick}
          onToggleExpand={onToggleExpand}
          level={0}
          folderIndexFile={folderIndexFile}
        />
      ))}
    </div>
  )
}

interface NavigationItemProps {
  node: NavigationNode
  selectedPath: string
  expandedNodes: Set<string>
  onNodeClick: (node: NavigationNode) => void
  onToggleExpand?: (nodeId: string) => void
  level: number
  folderIndexFile: string
}

function NavigationItem({
  node,
  selectedPath,
  expandedNodes,
  onNodeClick,
  onToggleExpand,
  level,
  folderIndexFile,
}: NavigationItemProps) {
  const isExpanded = expandedNodes.has(node.id)
  const isSelected = isNodeVisuallySelected(node, selectedPath, folderIndexFile)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="space-y-1" role="listitem">
      <div className={cn("px-2", level > 0 && "ml-4")}>
        <div
          className={cn(
            "w-full rounded-lg transition-all duration-150 border relative",
            isSelected
              ? "bg-ods-border border-ods-border"
              : "bg-ods-card border-ods-border"
          )}
        >
          <div className="flex items-center relative">
            <button
              className={cn(
                "w-full flex items-center h-12 px-2 rounded-lg text-[16px] font-medium font-['DM_Sans'] transition-all duration-150 leading-[1.33em] text-ods-text-primary",
                !isSelected && "hover:bg-ods-bg-secondary",
                hasChildren && "pr-12"
              )}
              onClick={() => onNodeClick(node)}
              aria-label={`${isSelected ? 'Selected' : 'Select'} ${node.name}`}
            >
              <span className="flex-shrink-0 mr-2">
                {node.type === 'folder' ? (
                  isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <span className="text-left truncate flex-1 min-w-0">
                {node.name.endsWith('.md') ? node.name.replace('.md', '') : node.name}
              </span>
              {node.type === 'folder' && node.hasReadme && (
                <span className="text-[10px] bg-ods-bg-secondary text-ods-text-tertiary px-1.5 py-0.5 rounded mr-2">
                  README
                </span>
              )}
            </button>

            {hasChildren && (
              <button
                className="absolute right-0 top-0 flex items-center justify-center w-12 h-12 text-ods-text-secondary hover:text-ods-text-primary transition-colors duration-150"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleExpand) {
                    onToggleExpand(node.id)
                  } else {
                    onNodeClick(node)
                  }
                }}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>

          {isSelected && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-[calc(100%-8px)] bg-ods-accent rounded-l" />
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children!.map(child => (
            <NavigationItem
              key={child.id}
              node={child}
              selectedPath={selectedPath}
              expandedNodes={expandedNodes}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              level={level + 1}
              folderIndexFile={folderIndexFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MobileNavigationDropdown({
  nodes,
  selectedPath,
  expandedNodes,
  onNodeClick,
  onToggleExpand,
  isLoading,
  className,
  folderIndexFile = DEFAULT_FOLDER_INDEX_FILE,
}: MultiLevelNavigationProps) {
  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 bg-ods-skeleton rounded-lg animate-pulse h-10" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {nodes.map(node => (
        <MobileNavigationItem
          key={node.id}
          node={node}
          selectedPath={selectedPath}
          expandedNodes={expandedNodes}
          onNodeClick={onNodeClick}
          onToggleExpand={onToggleExpand}
          level={0}
          folderIndexFile={folderIndexFile}
        />
      ))}
    </div>
  )
}

function MobileNavigationItem({
  node,
  selectedPath,
  expandedNodes,
  onNodeClick,
  onToggleExpand,
  level,
  folderIndexFile,
}: NavigationItemProps) {
  const isExpanded = expandedNodes.has(node.id)
  const isSelected = isNodeVisuallySelected(node, selectedPath, folderIndexFile)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div className="space-y-1">
      <div className={cn("px-2", level > 0 && "ml-3")}>
        <div
          className={cn(
            "w-full rounded-lg transition-all duration-150 border relative",
            isSelected
              ? "bg-ods-border border-ods-border"
              : "bg-ods-card border-ods-border"
          )}
        >
          <div className="flex items-center relative">
            <button
              className={cn(
                "w-full flex items-center h-11 px-2 rounded-lg text-[15px] font-medium font-['DM_Sans'] transition-all duration-150 leading-[1.33em] text-ods-text-primary",
                !isSelected && "hover:bg-ods-bg-secondary",
                hasChildren && "pr-11"
              )}
              onClick={() => onNodeClick(node)}
            >
              <span className="flex-shrink-0 mr-2">
                {node.type === 'folder' ? (
                  isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <span className="text-left truncate flex-1 min-w-0 text-sm">
                {node.name.endsWith('.md') ? node.name.replace('.md', '') : node.name}
              </span>
              {node.type === 'folder' && node.hasReadme && (
                <span className="text-[10px] bg-ods-bg-secondary text-ods-text-tertiary px-1.5 py-0.5 rounded mr-2">
                  README
                </span>
              )}
            </button>

            {hasChildren && (
              <button
                className="absolute right-0 top-0 flex items-center justify-center w-11 h-11 text-ods-text-secondary hover:text-ods-text-primary transition-colors duration-150"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onToggleExpand) {
                    onToggleExpand(node.id)
                  } else {
                    onNodeClick(node)
                  }
                }}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {isSelected && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-[calc(100%-8px)] bg-ods-accent rounded-l" />
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children!.map(child => (
            <MobileNavigationItem
              key={child.id}
              node={child}
              selectedPath={selectedPath}
              expandedNodes={expandedNodes}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              level={level + 1}
              folderIndexFile={folderIndexFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}
