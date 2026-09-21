/**
 * Text-style skeleton — matches a rendered markdown article layout.
 * Used by `<DocsHubPage>` as the default for `markdown` (and unknown
 * document types). Embedders can override via `renderSkeleton`.
 */
export function MarkdownSkeleton() {
  return (
    <div className="mt-6 space-y-7">
      <div className="space-y-[14px]">
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-3/4 animate-pulse rounded bg-ods-border" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-5/6 animate-pulse rounded bg-ods-border" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-2/3 animate-pulse rounded bg-ods-border" />
      </div>
      <div className="h-[88px] animate-pulse rounded-lg border border-ods-border bg-ods-card" />
      <div className="h-7 w-1/3 animate-pulse rounded bg-ods-border" />
      <div className="space-y-[14px]">
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-[72%] animate-pulse rounded bg-ods-border" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-[58%] animate-pulse rounded bg-ods-border" />
      </div>
      <div className="h-7 w-2/5 animate-pulse rounded bg-ods-border" />
      <div className="space-y-[14px]">
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-[90%] animate-pulse rounded bg-ods-border" />
      </div>
      <div className="space-y-[14px]">
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-full animate-pulse rounded bg-ods-border" />
        <div className="h-[16px] w-[70%] animate-pulse rounded bg-ods-border" />
      </div>
      <div className="h-[88px] animate-pulse rounded-lg border border-ods-border bg-ods-card" />
    </div>
  );
}

/**
 * Embed-style skeleton — matches the iframe loading state for `pdf`,
 * `google_sheet`, `figma`, and `file` document types. Used by
 * `<DocsHubPage>` as the default for non-markdown documentTypes.
 *
 * The skeleton is documentType-aware so its layout matches the actual
 * viewer that will replace it:
 *   - `pdf`                  → header with title + TWO buttons (Preview, Download)
 *   - `google_sheet`/`figma` → header with title + ONE button/toggle
 *   - `file`                 → centered FileDownloadCard-style box
 *   - undefined / others     → generic (1-button header)
 *
 * IMPORTANT: bars use `bg-ods-border` (NOT `bg-ods-skeleton`). The
 * `--ods-skeleton` token resolves to TRANSPARENT in this build, leaving
 * the skeleton box visually empty — the embed skeleton was the loudest
 * surface affected (a full-height iframe area showing nothing). Same fix
 * the chat-message-row skeleton already documents in its inline comment.
 */
export interface EmbedSkeletonProps {
  /** When provided, the header layout matches the eventual viewer's
   *  button count + arrangement, so the layout doesn't shift on load. */
  documentType?: 'pdf' | 'google_sheet' | 'figma' | 'file' | string;
}

export function EmbedSkeleton({ documentType }: EmbedSkeletonProps = {}) {
  // Centered card shape for the `file` documentType — matches
  // `<FileDownloadCard>`'s `flex flex-col items-center justify-center py-16`
  // + bordered card with icon, name, type/size row, Download button.
  if (documentType === 'file') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-ods-border bg-ods-card p-8 text-center">
          <div className="mx-auto h-16 w-16 animate-pulse rounded bg-ods-border" />
          <div className="space-y-2">
            <div className="mx-auto h-5 w-2/3 animate-pulse rounded bg-ods-border" />
            <div className="mx-auto h-4 w-1/2 animate-pulse rounded bg-ods-border" />
          </div>
          <div className="h-10 w-full animate-pulse rounded bg-ods-border" />
        </div>
      </div>
    );
  }

  // PDF viewer has TWO buttons (Preview + Download); Sheets / Figma
  // render ONE (Open / view-toggle). Default to one for unknown types.
  const buttonCount = documentType === 'pdf' ? 2 : 1;

  return (
    <div className="space-y-4">
      {/* Header — matches the actual viewer's
       *  `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
       *  (mobile-stacked, desktop-row). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: icon + title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="h-5 w-5 shrink-0 animate-pulse rounded bg-ods-border" />
          <div className="h-6 w-2/3 animate-pulse rounded bg-ods-border" />
        </div>
        {/* Right: 1 or 2 buttons. Mobile = full-width; desktop = auto. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {Array.from({ length: buttonCount }).map((_, i) => (
            <div key={i} className="h-10 w-full flex-1 animate-pulse rounded bg-ods-border sm:w-32 sm:flex-initial" />
          ))}
        </div>
      </div>
      {/* Body — clean iframe-sized rectangle, no fake inner placeholder
       *  cruft. Matches the viewer's default `calc(100vh - 250px)` height. */}
      <div
        className="w-full animate-pulse rounded-lg border border-ods-border bg-ods-card"
        style={{ height: 'calc(100vh - 250px)' }}
      />
    </div>
  );
}
