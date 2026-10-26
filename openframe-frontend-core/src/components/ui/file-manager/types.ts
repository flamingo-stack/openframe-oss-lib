import type { MouseEvent, ReactNode } from 'react';

export type FileType = 'file' | 'folder';

export type FileAction = 'download' | 'copy' | 'rename' | 'cut' | 'zip' | 'delete' | 'paste' | 'upload' | 'new-folder';

export interface FileItem {
  id: string;
  name: string;
  type: FileType;
  size?: string;
  modified: string;
  path: string;
  icon?: ReactNode;
  isSelected?: boolean;
}

export interface BreadcrumbItem {
  label: string;
  path: string;
}

export interface FileManagerProps {
  files: FileItem[];
  currentPath: string;
  selectedFiles: string[];
  deviceName?: string;
  deviceInfo?: string;
  searchQuery?: string;
  /** The folder is still being read: the file manager draws its loading state (breadcrumb, actions and search real and
   *  inert, the table's header real, its rows in their loading form). A loading scope does the same. */
  loading?: boolean;
  /** Whether the loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default
   *  `true`. */
  region?: boolean;
  isSearching?: boolean;
  showCheckboxes?: boolean;
  showSearch?: boolean;
  showActions?: boolean;
  canPaste?: boolean;
  disableSearch?: boolean;
  resultsCount?: number;
  onNavigate?: (path: string) => void;
  onBreadcrumbClick?: (path: string) => void;
  onSearch?: (query: string) => void;
  onSelectFile?: (fileId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onFileAction?: (action: FileAction, fileId?: string) => void;
  onFileClick?: (file: FileItem) => void;
  onFolderOpen?: (file: FileItem) => void;
  className?: string;
}

export interface FileManagerBreadcrumbProps {
  items: BreadcrumbItem[];
  onItemClick?: (path: string) => void;
  className?: string;
}

export interface FileManagerActionBarProps {
  canPaste?: boolean;
  hasSelection?: boolean;
  onNewFolder?: () => void;
  onPaste?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onUpload?: () => void;
  onSelectAll?: () => void;
  className?: string;
}

export interface FileManagerSearchBarProps {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  className?: string;
}

export interface FileManagerTableProps {
  files: FileItem[];
  selectedFiles: string[];
  resultsCount?: number;
  showCheckboxes?: boolean;
  loading?: boolean;
  isSearchResult?: boolean;
  onSelectFile?: (fileId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  onFileClick?: (file: FileItem) => void;
  onFolderOpen?: (file: FileItem) => void;
  onFileAction?: (action: FileAction, fileId: string) => void;
  onSort?: (column: 'name' | 'size' | 'modified') => void;
  sortBy?: 'name' | 'size' | 'modified';
  sortDirection?: 'asc' | 'desc';
  className?: string;
}

export interface FileManagerTableRowProps {
  /** The file the row shows. Absent while it is read: the row draws its loading form. */
  file?: FileItem | null;
  isSelected?: boolean;
  showCheckbox?: boolean;
  showPath?: boolean;
  onSelect?: (selected: boolean) => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
  onActionClick?: (action: FileAction) => void;
  /** The folder is still being read: the row draws its loading form (its frame, its read parts as bars). A loading
   *  scope does the same. */
  loading?: boolean;
  className?: string;
  /** Markers for the page's height gate (`data-loading-item`), carried by the row in both forms. */
  [marker: `data-${string}`]: unknown;
}

export interface FileManagerContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: FileAction) => void;
  fileType?: FileType;
  hasSelection?: boolean;
  trigger?: ReactNode;
  className?: string;
}

export interface FileIconProps {
  type: FileType;
  extension?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export interface FileManagerEmptyProps {
  message?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}
