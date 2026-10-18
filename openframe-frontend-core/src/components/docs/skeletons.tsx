import { EmbedLoadingSkeleton } from '../embeds/embed-iframe';
import { LoadingRegion } from '../loading/loading-region';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
/**
 * Text-style skeleton — matches a rendered markdown article layout.
 * Used by `<DocsHubPage>` as the default for `markdown` (and unknown
 * document types). Embedders can override via `renderSkeleton`.
 */
export function MarkdownSkeleton({
  region = true,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
} = {}) {
  return (
    <LoadingRegion label="Loading the document" announce={region} className="mt-6 space-y-7">
      <div className="space-y-[14px]">
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-3/4 rounded" />
      </div>
      <div className="space-y-[14px]">
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-5/6 rounded" />
      </div>
      <div className="space-y-[14px]">
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-2/3 rounded" />
      </div>
      <UnifiedSkeleton className="h-[88px] rounded-lg border border-ods-border" />
      <UnifiedSkeleton className="h-7 w-1/3 rounded" />
      <div className="space-y-[14px]">
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-[72%] rounded" />
      </div>
      <div className="space-y-[14px]">
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-[58%] rounded" />
      </div>
      <UnifiedSkeleton className="h-7 w-2/5 rounded" />
      <div className="space-y-[14px]">
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-[90%] rounded" />
      </div>
      <div className="space-y-[14px]">
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-full rounded" />
        <UnifiedSkeleton className="h-[16px] w-[70%] rounded" />
      </div>
      <UnifiedSkeleton className="h-[88px] rounded-lg border border-ods-border" />
    </LoadingRegion>
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
 */
export interface EmbedSkeletonProps {
  /** When provided, the header layout matches the eventual viewer's
   *  button count + arrangement, so the layout doesn't shift on load. */
  documentType?: 'pdf' | 'google_sheet' | 'figma' | 'file' | string;
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
}

export function EmbedSkeleton({ documentType, region = true }: EmbedSkeletonProps = {}) {
  // Centered card shape for the `file` documentType — matches
  // `<FileDownloadCard>`'s `flex flex-col items-center justify-center py-16`
  // + bordered card with icon, name, type/size row, Download button.
  if (documentType === 'file') {
    return (
      <LoadingRegion
        label="Loading the document"
        announce={region}
        className="flex flex-col items-center justify-center py-16"
      >
        <div className="w-full max-w-md space-y-4 rounded-xl border border-ods-border bg-ods-card p-8 text-center">
          <UnifiedSkeleton className="mx-auto h-16 w-16 rounded" />
          <div className="space-y-2">
            <UnifiedSkeleton className="mx-auto h-5 w-2/3 rounded" />
            <UnifiedSkeleton className="mx-auto h-4 w-1/2 rounded" />
          </div>
          <UnifiedSkeleton className="h-10 w-full rounded" />
        </div>
      </LoadingRegion>
    );
  }

  // PDF viewer has TWO buttons (Preview + Download); Sheets / Figma
  // render ONE (Open / view-toggle). Default to one for unknown types.
  const buttonCount = documentType === 'pdf' ? 2 : 1;

  return (
    <LoadingRegion label="Loading the document" announce={region} className="space-y-4">
      {/* Header — matches the actual viewer's
       *  `flex flex-col gap-3 content-sm:flex-row content-sm:items-center content-sm:justify-between`
       *  (mobile-stacked, desktop-row). */}
      <div className="flex flex-col gap-3 content-sm:flex-row content-sm:items-center content-sm:justify-between">
        {/* Left: icon + title */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <UnifiedSkeleton className="h-5 w-5 shrink-0 rounded" />
          <UnifiedSkeleton className="h-6 w-2/3 rounded" />
        </div>
        {/* Right: 1 or 2 buttons. Mobile = full-width; desktop = auto. */}
        <div className="flex w-full items-center gap-2 content-sm:w-auto">
          {Array.from({ length: buttonCount }).map((_, i) => (
            <UnifiedSkeleton key={i} className="h-10 w-full flex-1 rounded content-sm:w-32 content-sm:flex-initial" />
          ))}
        </div>
      </div>
      {/* Body: the iframe viewer's own loading box (its default `calc(100vh - 250px)` height). */}
      <EmbedLoadingSkeleton region={false} />
    </LoadingRegion>
  );
}
