import React from 'react';

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
    <main className={`bg-[#161616] ${animate ? 'animate-pulse' : ''} relative min-h-screen`}>
      <div className="max-w-[1920px] px-6 md:px-20 py-6 md:py-10 mx-auto space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="h-10 w-72 bg-[#2A2A2A] rounded" />
          <div className="h-4 w-80 bg-[#2A2A2A] rounded" />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-ods-card border border-ods-border rounded" />
          ))}
        </div>

        {/* MSP Profile & Report Info cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* MSP profile skeleton */}
          <div className="bg-ods-card border border-ods-border rounded-lg p-6 flex items-center gap-4 animate-pulse">
            <div className="w-14 h-14 rounded-lg bg-[#2A2A2A]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-[#2A2A2A] rounded w-3/4" />
              <div className="h-3 bg-[#2A2A2A] rounded w-1/2" />
            </div>
          </div>

          {/* Report info skeleton */}
          <div className="bg-ods-card border border-ods-border rounded-lg p-6 flex flex-col gap-4 animate-pulse">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-[#2A2A2A]" />
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-[#2A2A2A] rounded" />
                  <div className="h-3 w-20 bg-[#2A2A2A] rounded" />
                </div>
              </div>
              <div className="h-6 w-36 bg-[#2A2A2A] rounded" />
            </div>
            <div className="h-4 w-40 bg-[#2A2A2A] rounded mt-4" />
          </div>
        </div>

        {/* Vendor solution lists (Commercial & Open-Source) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {['Commercial Stack', 'Open-Source Stack'].map((label, idx) => (
            <div key={idx} className="bg-ods-card border border-ods-border rounded-lg overflow-hidden flex flex-col animate-pulse">
              {/* list header */}
              <div className="flex items-center justify-between px-6 py-4">
                <div className="h-6 w-40 bg-[#2A2A2A] rounded" />
                <div className="flex items-center gap-2">
                  <div className="h-5 w-20 bg-[#2A2A2A] rounded" />
                  <div className="h-4 w-10 bg-[#2A2A2A] rounded" />
                </div>
              </div>

              {/* vendor rows */}
              <div className="flex-1 flex flex-col gap-3 p-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="bg-[#161616] border border-ods-border rounded-lg px-4 py-3 flex items-center justify-between">
                    {/* left section: icon + text */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 bg-[#2A2A2A] rounded-lg flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <div className="h-4 w-32 bg-[#2A2A2A] rounded" />
                        <div className="hidden md:block h-3 w-24 bg-[#2A2A2A] rounded mt-1" />
                      </div>
                    </div>
                    {/* right addon: cost text */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="h-4 w-16 bg-[#2A2A2A] rounded" />
                      <div className="h-3 w-8 bg-[#2A2A2A] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Strategic Recommendations header placeholder */}
        <div className="h-6 w-60 bg-[#2A2A2A] rounded" />

        {/* Recommendations grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-ods-card border border-ods-border rounded" />
          ))}
        </div>

        {/* OpenFrame value section */}
        <div className="border border-ods-border rounded-3xl p-8 space-y-6">
          {/* Section header */}
          <div className="flex items-start gap-6">
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-8 w-72 bg-[#2A2A2A] rounded" />
              <div className="h-4 w-3/4 bg-[#2A2A2A] rounded" />
            </div>
            {/* Logo placeholder */}
            <div className="w-12 h-12 bg-[#2A2A2A] rounded-md shrink-0" />
          </div>

          {/* Value cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-ods-card border border-ods-border rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* CTA Overlay */}
      {overlayContent && (
        <div className="absolute inset-0 bg-ods-card/80 z-10 rounded-lg pointer-events-none">
          {/* Button centered relative to viewport */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex flex-col items-center gap-4 text-center px-4">
            {description && (
              <h3 >
                {description}
              </h3>
            )}
            {overlayContent}
          </div>
        </div>
      )}
    </main>
  );
} 