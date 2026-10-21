'use client';

import { FileManager } from './file-manager';

interface FileManagerSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  showSearch?: boolean;
  showActions?: boolean;
}

const NO_FILES: never[] = [];

/**
 * @deprecated Render `<FileManager loading … />`: the file manager draws its own loading state (breadcrumb, actions
 * and search real and inert, the table's header real, its rows in their loading form). This alias renders exactly that,
 * with nothing read yet.
 */
export function FileManagerSkeleton({
  region = true,
  showSearch = true,
  showActions = true,
}: FileManagerSkeletonProps) {
  return (
    <FileManager
      loading
      region={region}
      files={NO_FILES}
      currentPath=""
      selectedFiles={NO_FILES}
      showSearch={showSearch}
      showActions={showActions}
    />
  );
}
