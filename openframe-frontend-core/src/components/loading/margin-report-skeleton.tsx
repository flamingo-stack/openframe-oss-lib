import type React from 'react';

interface MarginReportSkeletonProps {
  /** Enable pulse animation (default: true) */
  animate?: boolean;
  /** Optional explanation text shown above overlay content */
  description?: React.ReactNode;
  /** Optional React node displayed over skeleton (button, loader, etc.) */
  overlayContent?: React.ReactNode;
}

export function MarginReportSkeleton({ animate = true, description, overlayContent }: MarginReportSkeletonProps) {
  return (
    <main className={`bg-ods-bg ${animate ? 'animate-pulse' : ''} relative min-h-screen`}>
      <div className="mx-auto max-w-[1920px] space-y-10 px-6 py-6 md:px-20 md:py-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="h-10 w-72 rounded bg-ods-skeleton" />
          <div className="h-4 w-80 rounded bg-ods-skeleton" />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded border border-ods-border bg-ods-card" />
          ))}
        </div>

        {/* MSP Profile & Report Info cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* MSP profile skeleton */}
          <div className="flex animate-pulse items-center gap-4 rounded-lg border border-ods-border bg-ods-card p-6">
            <div className="h-14 w-14 rounded-lg bg-ods-skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-ods-skeleton" />
              <div className="h-3 w-1/2 rounded bg-ods-skeleton" />
            </div>
          </div>

          {/* Report info skeleton */}
          <div className="flex animate-pulse flex-col gap-4 rounded-lg border border-ods-border bg-ods-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-lg bg-ods-skeleton" />
                <div className="space-y-1">
                  <div className="h-4 w-32 rounded bg-ods-skeleton" />
                  <div className="h-3 w-20 rounded bg-ods-skeleton" />
                </div>
              </div>
              <div className="h-6 w-36 rounded bg-ods-skeleton" />
            </div>
            <div className="mt-4 h-4 w-40 rounded bg-ods-skeleton" />
          </div>
        </div>

        {/* Vendor solution lists (Commercial & Open-Source) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {['Commercial Stack', 'Open-Source Stack'].map((label, idx) => (
            <div
              key={idx}
              className="flex animate-pulse flex-col overflow-hidden rounded-lg border border-ods-border bg-ods-card"
            >
              {/* list header */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="h-6 w-40 rounded bg-ods-skeleton" />
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 rounded bg-ods-skeleton" />
                  <div className="h-4 w-10 rounded bg-ods-skeleton" />
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
                      <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-ods-skeleton" />
                      <div className="flex min-w-0 flex-col">
                        <div className="h-4 w-32 rounded bg-ods-skeleton" />
                        <div className="mt-1 hidden h-3 w-24 rounded bg-ods-skeleton md:block" />
                      </div>
                    </div>
                    {/* right addon: cost text */}
                    <div className="flex flex-shrink-0 items-center gap-1">
                      <div className="h-4 w-16 rounded bg-ods-skeleton" />
                      <div className="h-3 w-8 rounded bg-ods-skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Strategic Recommendations header placeholder */}
        <div className="h-6 w-60 rounded bg-ods-skeleton" />

        {/* Recommendations grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded border border-ods-border bg-ods-card" />
          ))}
        </div>

        {/* OpenFrame value section */}
        <div className="space-y-6 rounded-3xl border border-ods-border p-8">
          {/* Section header */}
          <div className="flex items-start gap-6">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-8 w-72 rounded bg-ods-skeleton" />
              <div className="h-4 w-3/4 rounded bg-ods-skeleton" />
            </div>
            {/* Logo placeholder */}
            <div className="h-12 w-12 shrink-0 rounded-md bg-ods-skeleton" />
          </div>

          {/* Value cards grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded border border-ods-border bg-ods-card" />
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
    </main>
  );
}
