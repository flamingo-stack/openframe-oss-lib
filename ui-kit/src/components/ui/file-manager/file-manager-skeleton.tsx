'use client'

import React from 'react'
import { Skeleton } from '@flamingo/ui-kit'

interface FileManagerSkeletonProps {
  rows?: number
  showSearch?: boolean
  showActions?: boolean
}

export function FileManagerSkeleton({ 
  rows = 8,
  showSearch = true,
  showActions = true
}: FileManagerSkeletonProps) {
  const rowPlaceholders = Array.from({ length: rows })

  return (
    <div className="flex flex-col h-full bg-ods-bg">
      <div className="flex-1 flex flex-col py-6 space-y-6 min-h-0">
        {/* Breadcrumb and Action Bar */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Breadcrumb skeleton */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-5 w-24" />
          </div>
          
          {/* Action buttons skeleton */}
          {showActions && (
            <div className="flex-shrink-0 flex items-center gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-28" />
            </div>
          )}
        </div>
        
        {/* Search bar skeleton */}
        {showSearch && (
          <Skeleton className="h-10 w-full rounded-lg" />
        )}
        
        {/* Table skeleton */}
        <div className="flex-1 min-h-0">
          <div className="bg-ods-bg border border-ods-border rounded-lg flex flex-col">
            {/* Table header */}
            <div className="flex items-center h-12 px-4 bg-ods-bg-secondary border-b border-ods-border rounded-t-lg">
              {/* Checkbox */}
              <div className="mr-4">
                <Skeleton className="h-5 w-5 rounded" />
              </div>
              
              {/* Column headers */}
              <div className="flex items-center gap-3 flex-1 min-w-0 text-sm font-medium text-ods-text-secondary">
                NAME
              </div>
              
              <div className="w-24 shrink-0 pr-4 text-sm font-medium text-ods-text-secondary">
                SIZE
              </div>
              
              <div className="w-36 shrink-0 pl-4 text-sm font-medium text-ods-text-secondary">
                EDITED
              </div>
              
              <div className="w-48 shrink-0 pl-4 flex justify-end">
                {/* Empty space for actions */}
              </div>
            </div>
            
            {/* Table rows */}
            <div className="divide-y divide-ods-border rounded-b-lg flex-1 overflow-auto min-h-0">
              {rowPlaceholders.map((_, idx) => (
                <div key={idx} className="bg-ods-card flex items-center h-16 px-4 border-ods-border">
                  {/* Checkbox */}
                  <div className="mr-4">
                    <Skeleton className="h-5 w-5 rounded" />
                  </div>
                  
                  {/* File icon and name */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Skeleton className="h-6 w-6 rounded" />
                    <div className="flex flex-col min-w-0">
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
                  <div className="w-48 shrink-0 pl-4 flex items-center justify-end gap-1">
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
  )
}

