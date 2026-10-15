import type React from 'react';
import { LoadingRegion } from './loading-region';
import { UnifiedSkeleton } from './unified-skeleton';

interface MarginReportSkeletonProps {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  /** Enable pulse animation (default: true) */
  animate?: boolean;
  /** Optional explanation text shown above overlay content */
  description?: React.ReactNode;
  /** Optional React node displayed over skeleton (button, loader, etc.) */
  overlayContent?: React.ReactNode;
}

export function MarginReportSkeleton({
  region = true,
  animate = true,
  description,
  overlayContent,
}: MarginReportSkeletonProps) {
  return (
    <LoadingRegion
      label="Loading the report"
      as="main"
      announce={region && !overlayContent}
      className="relative min-h-screen bg-ods-bg"
    >
      <div className="mx-auto max-w-[1920px] space-y-10 px-6 py-6 content-md:px-20 content-md:py-10">
        {/* Header */}
        <div className="space-y-3">
          <UnifiedSkeleton className="h-10 w-72 rounded" animate={animate} />
          <UnifiedSkeleton className="h-4 w-80 rounded" animate={animate} />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-6 content-md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <UnifiedSkeleton key={i} className="h-32 rounded border border-ods-border" animate={animate} />
          ))}
        </div>

        {/* MSP Profile & Report Info cards */}
        <div className="grid grid-cols-1 gap-6 content-md:grid-cols-2">
          {/* MSP profile skeleton */}
          <div className="flex items-center gap-4 rounded-lg border border-ods-border bg-ods-card p-6">
            <UnifiedSkeleton className="h-14 w-14 rounded-lg" animate={animate} />
            <div className="flex-1 space-y-2">
              <UnifiedSkeleton className="h-4 w-3/4 rounded" animate={animate} />
              <UnifiedSkeleton className="h-3 w-1/2 rounded" animate={animate} />
            </div>
          </div>

          {/* Report info skeleton */}
          <div className="flex flex-col gap-4 rounded-lg border border-ods-border bg-ods-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <UnifiedSkeleton className="h-10 w-10 rounded-lg" animate={animate} />
                <div className="space-y-1">
                  <UnifiedSkeleton className="h-4 w-32 rounded" animate={animate} />
                  <UnifiedSkeleton className="h-3 w-20 rounded" animate={animate} />
                </div>
              </div>
              <UnifiedSkeleton className="h-6 w-36 rounded" animate={animate} />
            </div>
            <UnifiedSkeleton className="mt-4 h-4 w-40 rounded" animate={animate} />
          </div>
        </div>

        {/* Vendor solution lists (Commercial & Open-Source) */}
        <div className="grid grid-cols-1 gap-6 content-md:grid-cols-2">
          {['Commercial Stack', 'Open-Source Stack'].map((label, idx) => (
            <div key={idx} className="flex flex-col overflow-hidden rounded-lg border border-ods-border bg-ods-card">
              {/* list header */}
              <div className="flex items-center justify-between px-6 py-4">
                <UnifiedSkeleton className="h-6 w-40 rounded" animate={animate} />
                <div className="flex items-center gap-2">
                  <UnifiedSkeleton className="h-5 w-20 rounded" animate={animate} />
                  <UnifiedSkeleton className="h-4 w-10 rounded" animate={animate} />
                </div>
              </div>

              {/* vendor rows */}
              <div className="flex flex-1 flex-col gap-3 p-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div
                    key={j}
                    className="flex items-center justify-between rounded-lg border border-ods-border bg-ods-bg px-4 py-3"
                  >
                    {/* left section: icon + text */}
                    <div className="flex min-w-0 items-center gap-3">
                      <UnifiedSkeleton className="h-12 w-12 flex-shrink-0 rounded-lg" animate={animate} />
                      <div className="flex min-w-0 flex-col">
                        <UnifiedSkeleton className="h-4 w-32 rounded" animate={animate} />
                        <UnifiedSkeleton className="mt-1 hidden h-3 w-24 rounded content-md:block" animate={animate} />
                      </div>
                    </div>
                    {/* right addon: cost text */}
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <UnifiedSkeleton className="h-4 w-16 rounded" animate={animate} />
                      <UnifiedSkeleton className="h-3 w-8 rounded" animate={animate} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Strategic Recommendations header placeholder */}
        <UnifiedSkeleton className="h-6 w-60 rounded" animate={animate} />

        {/* Recommendations grid */}
        <div className="grid grid-cols-1 gap-6 content-md:grid-cols-2 content-lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <UnifiedSkeleton key={i} className="h-48 rounded border border-ods-border" animate={animate} />
          ))}
        </div>

        {/* OpenFrame value section */}
        <div className="space-y-6 rounded-3xl border border-ods-border p-8">
          {/* Section header */}
          <div className="flex items-start gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <UnifiedSkeleton className="h-8 w-72 rounded" animate={animate} />
              <UnifiedSkeleton className="h-4 w-3/4 rounded" animate={animate} />
            </div>
            {/* Logo placeholder */}
            <UnifiedSkeleton className="h-12 w-12 shrink-0 rounded-md" animate={animate} />
          </div>

          {/* Value cards grid */}
          <div className="grid grid-cols-1 gap-6 content-md:grid-cols-2 content-lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <UnifiedSkeleton key={i} className="h-32 rounded border border-ods-border" animate={animate} />
            ))}
          </div>
        </div>
      </div>

      {/* CTA Overlay */}
      {overlayContent && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-lg bg-ods-card/80">
          {/* Button centered relative to viewport */}
          <div className="pointer-events-auto fixed left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4 px-4 text-center">
            {description && <h3>{description}</h3>}
            {overlayContent}
          </div>
        </div>
      )}
    </LoadingRegion>
  );
}
