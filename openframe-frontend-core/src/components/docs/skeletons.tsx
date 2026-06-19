import React from 'react'

/**
 * Text-style skeleton — matches a rendered markdown article layout.
 * Used by `<DocsHubPage>` as the default for `markdown` (and unknown
 * document types). Embedders can override via `renderSkeleton`.
 */
export function MarkdownSkeleton() {
  return (
    <div className="space-y-7 mt-6">
      <div className="space-y-[14px]">
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-3/4 animate-pulse" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-5/6 animate-pulse" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-2/3 animate-pulse" />
      </div>
      <div className="h-[88px] bg-ods-card border border-ods-border rounded-lg animate-pulse" />
      <div className="h-7 bg-ods-border rounded w-1/3 animate-pulse" />
      <div className="space-y-[14px]">
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-[72%] animate-pulse" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-[58%] animate-pulse" />
      </div>
      <div className="h-7 bg-ods-border rounded w-2/5 animate-pulse" />
      <div className="space-y-[14px]">
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-[90%] animate-pulse" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-full animate-pulse" />
        <div className="h-[16px] bg-ods-border rounded w-[70%] animate-pulse" />
      </div>
      <div className="h-[88px] bg-ods-card border border-ods-border rounded-lg animate-pulse" />
    </div>
  )
}

/**
 * Embed-style skeleton — matches the iframe loading state for `pdf`,
 * `google_sheet`, `figma`, and `file` document types. Used by
 * `<DocsHubPage>` as the default for non-markdown documentTypes.
 */
export function EmbedSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-7 bg-ods-skeleton rounded w-1/3 animate-pulse" />
        <div className="h-9 bg-ods-skeleton rounded w-24 animate-pulse" />
      </div>
      <div
        className="w-full rounded-lg border border-ods-border overflow-hidden bg-ods-skeleton animate-pulse"
        style={{ height: 'calc(100vh - 250px)' }}
      >
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="w-12 h-12 rounded-lg bg-ods-card" />
          <div className="h-4 w-48 rounded bg-ods-card" />
          <div className="h-3 w-32 rounded bg-ods-card" />
        </div>
      </div>
    </div>
  )
}
