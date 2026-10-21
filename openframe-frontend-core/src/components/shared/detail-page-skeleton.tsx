'use client';

import { PageLayout } from '../layout/page-layout';
import { LoadingRegion } from '../loading/loading-region';
import { UnifiedSkeleton } from '../loading/unified-skeleton';

export interface DetailPageSkeletonProps {
  metadataColumns?: number; // Number of metadata grid columns (default 4)
  showImageGallery?: boolean; // Show horizontal image gallery (default true)
  /** Render only the skeleton blocks, WITHOUT the self-contained page wrapper
   *  — the caller supplies its own (e.g. `<PageShell>`) so the loading state
   *  matches the loaded page's width, padding, and min-height. Default false
   *  (self-contained `<PageLayout>` at the hub article width). */
  bare?: boolean;
  /** What is loading, read once by a screen reader. Default "Loading". */
  label?: string;
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
}

/** `content-md:grid-cols-N` as static classes the build can see (a class built from a number is never generated). */
const METADATA_COLUMNS_CLASS: Record<number, string> = {
  1: 'content-md:grid-cols-1',
  2: 'content-md:grid-cols-2',
  3: 'content-md:grid-cols-3',
  4: 'content-md:grid-cols-4',
  5: 'content-md:grid-cols-5',
  6: 'content-md:grid-cols-6',
};

/**
 * @deprecated Render the detail page itself inside a `LoadingScope` (e.g. `ArticleDetailLayout` with its sections): each part draws its own skeleton. Kept so hosts on an older release keep compiling; nothing in the lib uses it.
 */
export function DetailPageSkeleton({
  metadataColumns = 4,
  showImageGallery = true,
  bare = false,
  label = 'Loading',
  region = true,
}: DetailPageSkeletonProps = {}) {
  const content = (
    <LoadingRegion label={label} announce={region} className="space-y-6 content-md:space-y-10">
      {/* Title Block */}
      <div className="flex w-full flex-col gap-6">
        <UnifiedSkeleton className="h-16 w-full max-w-3xl rounded content-md:h-20" />
      </div>

      {/* Category Tags Skeleton */}
      <div className="flex w-full flex-wrap gap-2">
        <UnifiedSkeleton className="h-8 w-32 rounded" />
        <UnifiedSkeleton className="h-8 w-28 rounded" />
        <UnifiedSkeleton className="h-8 w-36 rounded" />
      </div>

      {/* Metadata Grid Skeleton */}
      <div
        className={`grid grid-cols-1 ${METADATA_COLUMNS_CLASS[metadataColumns] ?? METADATA_COLUMNS_CLASS[4]} w-full overflow-hidden rounded-md border border-ods-border`}
      >
        {Array.from({ length: metadataColumns }).map((_, i) => (
          <div
            key={i}
            className="border-b border-ods-border bg-ods-card p-4 last:border-r-0 content-md:border-b-0 content-md:border-r"
          >
            <UnifiedSkeleton className="mb-2 h-6 w-24 rounded" />
            <UnifiedSkeleton className="h-5 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Image Gallery Skeleton */}
      {showImageGallery && (
        <div className="flex w-full gap-6 overflow-x-auto">
          {[1, 2, 3, 4, 5].map(i => (
            <UnifiedSkeleton key={i} className="h-[200px] w-[240px] shrink-0 rounded-md border border-ods-border" />
          ))}
        </div>
      )}

      {/* Featured Image Skeleton (for case studies) */}
      {!showImageGallery && <UnifiedSkeleton className="aspect-[2560/1366] w-full rounded-md" />}

      {/* Content Sections Skeleton */}
      {[1, 2, 3].map(section => (
        <div key={section} className="space-y-6">
          <UnifiedSkeleton className="h-16 w-64 rounded" />
          <div className="space-y-3">
            <UnifiedSkeleton className="h-6 w-full rounded" />
            <UnifiedSkeleton className="h-6 w-full rounded" />
            <UnifiedSkeleton className="h-6 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
  if (bare) return content;
  return (
    <PageLayout
      showHeader={false}
      className="mx-auto max-w-[1280px] bg-ods-bg px-6 py-6 content-md:px-20 content-md:py-10"
    >
      {content}
    </PageLayout>
  );
}
