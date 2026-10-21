'use client';

import { ChevronDown, ChevronUp, FileText, Folder, FolderOpen } from 'lucide-react';
import { cn } from '../../utils/cn';
import { DEFAULT_FOLDER_INDEX_FILE as CANONICAL_FOLDER_INDEX_FILE } from '../../utils/doc-tree-nav';
import { MediaSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';

export interface NavigationNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  hasReadme?: boolean;
  children?: NavigationNode[];
  slug?: string;
  // Mirror DocNode's extra optional fields so a DocNode tree is structurally
  // assignable to NavigationNode[] without an `as` cast. NavigationNode
  // intentionally never reads these — they're carried for type-compat only.
  documentType?: 'markdown' | 'pdf' | 'google_sheet' | 'figma' | 'file';
  sortOrder?: number;
}

interface MultiLevelNavigationProps {
  nodes: NavigationNode[];
  selectedPath: string;
  expandedNodes: Set<string>;
  onNodeClick: (node: NavigationNode) => void;
  onToggleExpand?: (nodeId: string) => void;
  isLoading?: boolean;
  className?: string;
  /** Folder-index filename (default `'README.md'`, case-insensitive). When the
   *  selectedPath is a folder with this file, the visual ribbon moves to the
   *  child file. */
  folderIndexFile?: string;
}

// SSOT lives in `doc-tree-nav` (canonical case `'README.md'`). The visual
// comparator below lowercases both sides, so re-exporting the canonical
// constant under the same local name preserves call-site syntax without
// drifting from the SSOT.
const DEFAULT_FOLDER_INDEX_FILE = CANONICAL_FOLDER_INDEX_FILE;

/**
 * The tree's list, item and row frame, read by the tree and by its skeleton, so the skeleton is its size. The tree's
 * entries are a read list (`data-loading-item`; an open folder holds its children's items).
 */
const NAV_LIST_CLASS = 'space-y-2';
const NAV_ITEM_CLASS = 'space-y-1';
const NAV_ROW_FRAME_CLASS = 'relative w-full rounded-lg border transition-all duration-150';
const NAV_ROW_CONTENT_CLASS = 'flex w-full items-center rounded-lg px-2 text-h6';
/** Each entry's side padding, around its row frame. */
const NAV_ROW_PAD_CLASS = 'px-2';
/**
 * A row's height (the desktop tree's, the dropdown's), with the folder toggle's square box at the row's end and the
 * room the name leaves for it: read by the loaded rows and by their skeleton.
 */
const NAV_ROW_HEIGHT = {
  desktop: { row: 'h-12', toggle: 'h-12 w-12', toggleRoom: 'pr-12' },
  mobile: { row: 'h-11', toggle: 'h-11 w-11', toggleRoom: 'pr-11' },
} as const;
/**
 * How many rows each skeleton draws (the desktop tree, the mobile dropdown) when its host states no count. The tree
 * lists every entry its source holds (no page, no limit), so this is a typical count, drawn at every width. The tree
 * opens on the reader's repository, so the skeleton draws that shape: one root entry open, the rest its entries
 * (indented as the tree indents them). It is drawn open FIRST: the root order is the source's path sort, and which
 * repositories sort before the reader's needs the read, so a page in a later repository differs by one collapsed
 * root row above the open one. A host that knows its entry count passes it as `rows`.
 */
export const MULTI_LEVEL_NAVIGATION_SKELETON_ROWS = 17;
export const MOBILE_NAVIGATION_SKELETON_ROWS = 17;
const NAV_SKELETON_LABEL_WIDTHS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-1/3'] as const;
/** An open folder's entries: the list under its row, and each entry's indent (the desktop tree's, the dropdown's). */
const NAV_CHILDREN_CLASS = 'space-y-1';
const NAV_INDENT_CLASS = { desktop: 'ml-4', mobile: 'ml-3' } as const;

/** One row's frame while it loads: an icon box and a bar of its name. */
function NavigationRowSkeleton({
  index,
  rowHeightClass,
  indentClass,
}: {
  index: number;
  rowHeightClass: string;
  indentClass?: string;
}) {
  return (
    <div className={cn(NAV_ROW_PAD_CLASS, indentClass)}>
      <div className={cn(NAV_ROW_FRAME_CLASS, 'border-ods-border bg-ods-card')}>
        <div className={cn(NAV_ROW_CONTENT_CLASS, rowHeightClass)}>
          <MediaSkeleton.Icon size="sm" className="mr-2 flex-shrink-0" />
          <TextLineSkeleton type="h6" className={NAV_SKELETON_LABEL_WIDTHS[index % NAV_SKELETON_LABEL_WIDTHS.length]} />
        </div>
      </div>
    </div>
  );
}

function NavigationTreeSkeleton({
  rows,
  rowHeightClass,
  indentClass,
  className,
}: {
  rows: number;
  rowHeightClass: string;
  indentClass: string;
  className?: string;
}) {
  return (
    <div className={cn(NAV_LIST_CLASS, className)} aria-hidden>
      {/* The open root entry: its row, then its entries, each an item of the tree's read list. */}
      <div className={NAV_ITEM_CLASS} data-loading-item>
        <NavigationRowSkeleton index={0} rowHeightClass={rowHeightClass} />
        {rows > 1 && (
          <div className={NAV_CHILDREN_CLASS}>
            {Array.from({ length: rows - 1 }, (_, i) => (
              <div key={i} className={NAV_ITEM_CLASS} data-loading-item>
                <NavigationRowSkeleton index={i + 1} rowHeightClass={rowHeightClass} indentClass={indentClass} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The documentation tree while it is read: its rows' frames, each with an icon box and a bar of its name. */
export function MultiLevelNavigationSkeleton({
  rows = MULTI_LEVEL_NAVIGATION_SKELETON_ROWS,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <NavigationTreeSkeleton
      rows={rows}
      rowHeightClass={NAV_ROW_HEIGHT.desktop.row}
      indentClass={NAV_INDENT_CLASS.desktop}
      className={className}
    />
  );
}

/** The mobile documentation dropdown while it is read: the same rows at the dropdown's height. */
export function MobileNavigationDropdownSkeleton({
  rows = MOBILE_NAVIGATION_SKELETON_ROWS,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <NavigationTreeSkeleton
      rows={rows}
      rowHeightClass={NAV_ROW_HEIGHT.mobile.row}
      indentClass={NAV_INDENT_CLASS.mobile}
      className={className}
    />
  );
}

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
  const FOLDER_INDEX_FILE = folderIndexFile.toLowerCase();
  // Path comparisons keyed on `node.path` (raw, includes `.md`). Do NOT use
  // `node.name` — the tree-builder runs it through `formatDocName` which strips
  // the `.md` extension, so `node.name.toLowerCase() === 'readme.md'` is always
  // false.
  if (selectedPath === node.path) {
    // Explicit match — but folder-with-README defers to its README child.
    return !(node.type === 'folder' && node.hasReadme);
  }
  if (node.type !== 'file') return false;
  const pathLower = node.path.toLowerCase();
  // Implicit: README child whose parent folder is the selectedPath.
  if (selectedPath !== '' && pathLower === `${selectedPath.toLowerCase()}/${FOLDER_INDEX_FILE}`) {
    return true;
  }
  // Implicit: ROOT README on the landing page (selectedPath === '' means
  // "no explicit doc selected" — the viewer falls back to the root folder-
  // index file, so that file IS the active document).
  if (selectedPath === '' && pathLower === FOLDER_INDEX_FILE) {
    return true;
  }
  return false;
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
  if (useLoadingScope() || isLoading) return <MultiLevelNavigationSkeleton className={className} />;

  return (
    <div className={cn(NAV_LIST_CLASS, className)} role="list" aria-label="Navigation list">
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
  );
}

interface NavigationItemProps {
  node: NavigationNode;
  selectedPath: string;
  expandedNodes: Set<string>;
  onNodeClick: (node: NavigationNode) => void;
  onToggleExpand?: (nodeId: string) => void;
  level: number;
  folderIndexFile: string;
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
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = isNodeVisuallySelected(node, selectedPath, folderIndexFile);
  // Bind the (optional) child list once so the render below maps a real array
  // rather than re-deriving `hasChildren` and asserting it away.
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <div className={NAV_ITEM_CLASS} role="listitem" data-loading-item>
      <div className={cn(NAV_ROW_PAD_CLASS, level > 0 && NAV_INDENT_CLASS.desktop)}>
        <div
          className={cn(
            NAV_ROW_FRAME_CLASS,
            isSelected ? 'border-ods-border bg-ods-border' : 'border-ods-border bg-ods-card',
          )}
        >
          <div className="relative flex items-center">
            <button
              className={cn(
                NAV_ROW_CONTENT_CLASS,
                NAV_ROW_HEIGHT.desktop.row,
                'text-ods-text-primary transition-all duration-150',
                !isSelected && 'hover:bg-ods-bg-hover',
                hasChildren && NAV_ROW_HEIGHT.desktop.toggleRoom,
              )}
              onClick={() => onNodeClick(node)}
              aria-label={`${isSelected ? 'Selected' : 'Select'} ${node.name}`}
            >
              <span className="mr-2 flex-shrink-0">
                {node.type === 'folder' ? (
                  isExpanded ? (
                    <FolderOpen className="h-4 w-4" />
                  ) : (
                    <Folder className="h-4 w-4" />
                  )
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">
                {node.name.endsWith('.md') ? node.name.replace('.md', '') : node.name}
              </span>
              {node.type === 'folder' && node.hasReadme && (
                <span className="mr-2 rounded bg-ods-bg-surface px-1.5 py-0.5 text-ods-text-secondary text-h6">
                  README
                </span>
              )}
            </button>

            {hasChildren && (
              <button
                className={cn(
                  'absolute right-0 top-0 flex items-center justify-center text-ods-text-secondary transition-colors duration-150 hover:text-ods-text-primary',
                  NAV_ROW_HEIGHT.desktop.toggle,
                )}
                onClick={e => {
                  e.stopPropagation();
                  if (onToggleExpand) {
                    onToggleExpand(node.id);
                  } else {
                    onNodeClick(node);
                  }
                }}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>

          {isSelected && (
            <div className="absolute right-0 top-1/2 h-[calc(100%-8px)] w-1 -translate-y-1/2 rounded-l bg-ods-accent" />
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className={NAV_CHILDREN_CLASS}>
          {children.map(child => (
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
  );
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
  if (useLoadingScope() || isLoading) return <MobileNavigationDropdownSkeleton className={className} />;

  return (
    <div className={cn(NAV_LIST_CLASS, className)}>
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
  );
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
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = isNodeVisuallySelected(node, selectedPath, folderIndexFile);
  // Same binding as the desktop item above — a real array to map, no assertion.
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <div className={NAV_ITEM_CLASS} data-loading-item>
      <div className={cn(NAV_ROW_PAD_CLASS, level > 0 && NAV_INDENT_CLASS.mobile)}>
        <div
          className={cn(
            NAV_ROW_FRAME_CLASS,
            isSelected ? 'border-ods-border bg-ods-border' : 'border-ods-border bg-ods-card',
          )}
        >
          <div className="relative flex items-center">
            <button
              className={cn(
                NAV_ROW_CONTENT_CLASS,
                NAV_ROW_HEIGHT.mobile.row,
                'text-ods-text-primary transition-all duration-150',
                !isSelected && 'hover:bg-ods-bg-hover',
                hasChildren && NAV_ROW_HEIGHT.mobile.toggleRoom,
              )}
              onClick={() => onNodeClick(node)}
            >
              <span className="mr-2 flex-shrink-0">
                {node.type === 'folder' ? (
                  isExpanded ? (
                    <FolderOpen className="h-4 w-4" />
                  ) : (
                    <Folder className="h-4 w-4" />
                  )
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-left">
                {node.name.endsWith('.md') ? node.name.replace('.md', '') : node.name}
              </span>
              {node.type === 'folder' && node.hasReadme && (
                <span className="mr-2 rounded bg-ods-bg-surface px-1.5 py-0.5 text-ods-text-secondary text-h6">
                  README
                </span>
              )}
            </button>

            {hasChildren && (
              <button
                className={cn(
                  'absolute right-0 top-0 flex items-center justify-center text-ods-text-secondary transition-colors duration-150 hover:text-ods-text-primary',
                  NAV_ROW_HEIGHT.mobile.toggle,
                )}
                onClick={e => {
                  e.stopPropagation();
                  if (onToggleExpand) {
                    onToggleExpand(node.id);
                  } else {
                    onNodeClick(node);
                  }
                }}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
              >
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {isSelected && (
            <div className="absolute right-0 top-1/2 h-[calc(100%-8px)] w-1 -translate-y-1/2 rounded-l bg-ods-accent" />
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className={NAV_CHILDREN_CLASS}>
          {children.map(child => (
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
  );
}
