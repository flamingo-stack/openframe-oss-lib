'use client';

import { PageLayout } from '../layout/page-layout';

export interface DetailPageSkeletonProps {
  metadataColumns?: number; // Number of metadata grid columns (default 4)
  showImageGallery?: boolean; // Show horizontal image gallery (default true)
  /** Render only the skeleton blocks, WITHOUT the self-contained page wrapper
   *  — the caller supplies its own (e.g. `<PageShell>`) so the loading state
   *  matches the loaded page's width, padding, and min-height. Default false
   *  (self-contained `<PageLayout>` at the hub article width). */
  bare?: boolean;
}

export function DetailPageSkeleton({
  metadataColumns = 4,
  showImageGallery = true,
  bare = false,
}: DetailPageSkeletonProps = {}) {
  const content = (
    <div className="animate-pulse space-y-6 md:space-y-10">
      {/* Title Block */}
      <div className="flex w-full flex-col gap-6">
        <div className="h-16 w-full max-w-3xl rounded bg-ods-card md:h-20"></div>
      </div>

      {/* Category Tags Skeleton */}
      <div className="flex w-full flex-wrap gap-2">
        <div className="h-8 w-32 rounded bg-ods-card"></div>
        <div className="h-8 w-28 rounded bg-ods-card"></div>
        <div className="h-8 w-36 rounded bg-ods-card"></div>
      </div>

      {/* Metadata Grid Skeleton */}
      <div
        className={`grid grid-cols-1 md:grid-cols-${metadataColumns} w-full overflow-hidden rounded-md border border-ods-border`}
      >
        {Array.from({ length: metadataColumns }).map((_, i) => (
          <div key={i} className="border-b border-ods-border bg-ods-card p-4 last:border-r-0 md:border-b-0 md:border-r">
            <div className="mb-2 h-6 w-24 rounded bg-ods-border"></div>
            <div className="h-5 w-20 rounded bg-ods-border"></div>
          </div>
        ))}
      </div>

      {/* Image Gallery Skeleton */}
      {showImageGallery && (
        <div className="flex w-full gap-6 overflow-x-auto">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-[200px] w-[240px] shrink-0 rounded-md border border-ods-border bg-ods-card"></div>
          ))}
        </div>
      )}

      {/* Featured Image Skeleton (for case studies) */}
      {!showImageGallery && <div className="aspect-[2560/1366] w-full rounded-md bg-ods-card"></div>}

      {/* Content Sections Skeleton */}
      {[1, 2, 3].map(section => (
        <div key={section} className="space-y-6">
          <div className="h-16 w-64 rounded bg-ods-card"></div>
          <div className="space-y-3">
            <div className="h-6 w-full rounded bg-ods-card"></div>
            <div className="h-6 w-full rounded bg-ods-card"></div>
            <div className="h-6 w-4/5 rounded bg-ods-card"></div>
          </div>
        </div>
      ))}
    </div>
  );
  if (bare) return content;
  return (
    <PageLayout showHeader={false} className="mx-auto max-w-[1280px] bg-ods-bg px-6 py-6 md:px-20 md:py-10">
      {content}
    </PageLayout>
  );
}
