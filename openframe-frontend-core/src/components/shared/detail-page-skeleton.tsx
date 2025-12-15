"use client";

import { PageContainer } from '../layout/page-container';

export interface DetailPageSkeletonProps {
  metadataColumns?: number; // Number of metadata grid columns (default 4)
  showImageGallery?: boolean; // Show horizontal image gallery (default true)
}

export function DetailPageSkeleton({
  metadataColumns = 4,
  showImageGallery = true
}: DetailPageSkeletonProps = {}) {
  return (
    <PageContainer
      as="article"
      backgroundClassName="bg-ods-bg"
      contentPadding="py-6 md:py-10 px-6 md:px-20"
      maxWidth="max-w-[1280px]"
    >
      <div className="space-y-6 md:space-y-10 animate-pulse">
        {/* Title Block */}
        <div className="flex flex-col gap-6 w-full">
          <div className="h-16 md:h-20 w-full max-w-3xl bg-ods-card rounded"></div>
        </div>

        {/* Category Tags Skeleton */}
        <div className="flex flex-wrap gap-2 w-full">
          <div className="h-8 w-32 bg-ods-card rounded"></div>
          <div className="h-8 w-28 bg-ods-card rounded"></div>
          <div className="h-8 w-36 bg-ods-card rounded"></div>
        </div>

        {/* Metadata Grid Skeleton */}
        <div className={`grid grid-cols-1 md:grid-cols-${metadataColumns} border border-ods-border rounded-md overflow-hidden w-full`}>
          {Array.from({ length: metadataColumns }).map((_, i) => (
            <div key={i} className="bg-ods-card border-b md:border-b-0 md:border-r last:border-r-0 border-ods-border p-4">
              <div className="h-6 w-24 bg-ods-border rounded mb-2"></div>
              <div className="h-5 w-20 bg-ods-border rounded"></div>
            </div>
          ))}
        </div>

        {/* Image Gallery Skeleton */}
        {showImageGallery && (
          <div className="flex gap-6 overflow-x-auto w-full">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="shrink-0 w-[240px] h-[200px] bg-ods-card rounded-md border border-ods-border"></div>
            ))}
          </div>
        )}

        {/* Featured Image Skeleton (for case studies) */}
        {!showImageGallery && (
          <div className="aspect-[2560/1366] w-full bg-ods-card rounded-md"></div>
        )}

        {/* Content Sections Skeleton */}
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-6">
            <div className="h-16 w-64 bg-ods-card rounded"></div>
            <div className="space-y-3">
              <div className="h-6 w-full bg-ods-card rounded"></div>
              <div className="h-6 w-full bg-ods-card rounded"></div>
              <div className="h-6 w-4/5 bg-ods-card rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
