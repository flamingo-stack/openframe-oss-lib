'use client';

import { Skeleton } from '../skeleton';

interface FileManagerSkeletonProps {
  rows?: number;
  showSearch?: boolean;
  showActions?: boolean;
}

export function FileManagerSkeleton({ rows = 8, showSearch = true, showActions = true }: FileManagerSkeletonProps) {
  const rowPlaceholders = Array.from({ length: rows });

  return (
    <div className="flex h-full flex-col bg-ods-bg">
      <div className="flex min-h-0 flex-1 flex-col space-y-6 py-6">
        {/* Breadcrumb and Action Bar */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Breadcrumb skeleton */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-5 w-24" />
          </div>

          {/* Action buttons skeleton */}
          {showActions && (
            <div className="flex flex-shrink-0 items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-28" />
            </div>
          )}
        </div>

        {/* Search bar skeleton */}
        {showSearch && <Skeleton className="h-10 w-full rounded-lg" />}

        {/* Table skeleton */}
        <div className="min-h-0 flex-1">
          <div className="flex flex-col rounded-lg border border-ods-border bg-ods-bg">
            {/* Table header */}
            <div className="flex h-12 items-center rounded-t-lg border-b border-ods-border bg-ods-bg-surface px-4">
              {/* Checkbox */}
              <div className="mr-4">
                <Skeleton className="h-5 w-5 rounded" />
              </div>

              {/* Column headers */}
              <div className="flex min-w-0 flex-1 items-center gap-3 text-ods-text-secondary text-h5">NAME</div>

              <div className="w-24 shrink-0 pr-4 text-ods-text-secondary text-h5">SIZE</div>

              <div className="w-36 shrink-0 pl-4 text-ods-text-secondary text-h5">EDITED</div>

              <div className="flex w-48 shrink-0 justify-end pl-4">{/* Empty space for actions */}</div>
            </div>

            {/* Table rows */}
            <div className="min-h-0 flex-1 divide-y divide-ods-border overflow-auto rounded-b-lg">
              {rowPlaceholders.map((_, idx) => (
                <div key={idx} className="flex h-16 items-center border-ods-border bg-ods-card px-4">
                  {/* Checkbox */}
                  <div className="mr-4">
                    <Skeleton className="h-5 w-5 rounded" />
                  </div>

                  {/* File icon and name */}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded" />
                    <div className="flex min-w-0 flex-col">
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>

                  {/* Size */}
                  <div className="w-24 shrink-0 pr-4">
                    <Skeleton className="h-4 w-16" />
                  </div>

                  {/* Modified date */}
                  <div className="w-36 shrink-0 pl-4">
                    <Skeleton className="h-4 w-24" />
                  </div>

                  {/* Action buttons */}
                  <div className="flex w-48 shrink-0 items-center justify-end gap-1 pl-4">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
