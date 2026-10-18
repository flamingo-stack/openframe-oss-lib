import { cn } from '../../utils/cn';
import { EmbedLoadingSkeleton } from '../embeds/embed-iframe';
import { LoadingRegion } from '../loading/loading-region';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { MARKDOWN_H2_CLASS, MARKDOWN_PARAGRAPH_CLASS } from '../ui/markdown/base-components';
import { TEXT_SIZE_PRESETS } from '../ui/markdown/text-size';
/**
 * Text-style skeleton — matches a rendered markdown article layout.
 * Used by `<DocsHubPage>` as the default for `markdown` (and unknown
 * document types). Embedders can override via `renderSkeleton`.
 */
/** Paragraphs and headings the markdown skeleton draws (a document's first fold), with each paragraph's lines. */
const MARKDOWN_SKELETON_BLOCKS = [
  { kind: 'p', lines: 4 },
  { kind: 'p', lines: 4 },
  { kind: 'p', lines: 5 },
  { kind: 'h2' },
  { kind: 'p', lines: 4 },
  { kind: 'p', lines: 5 },
  { kind: 'h2' },
  { kind: 'p', lines: 3 },
  { kind: 'p', lines: 4 },
] as const;
const MARKDOWN_SKELETON_H2_CLASS = cn(MARKDOWN_H2_CLASS, TEXT_SIZE_PRESETS.default.h2);
const MARKDOWN_SKELETON_P_CLASS = cn(MARKDOWN_PARAGRAPH_CLASS, TEXT_SIZE_PRESETS.default.p);

export function MarkdownSkeleton({
  region = true,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
} = {}) {
  // The rendered document's own heading and paragraph elements (the markdown renderer's default preset), each line a
  // bar of the element's line box.
  return (
    <LoadingRegion label="Loading the document" announce={region} className="mt-6">
      {MARKDOWN_SKELETON_BLOCKS.map((block, i) =>
        block.kind === 'h2' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton blocks never reorder
          <h2 key={i} className={MARKDOWN_SKELETON_H2_CLASS} aria-hidden>
            <TextLineSkeleton type="inherit" as="span" className="w-1/3" />
          </h2>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton blocks never reorder
          <p key={i} className={MARKDOWN_SKELETON_P_CLASS} aria-hidden>
            <TextLineSkeleton type="inherit" as="span" lines={block.lines} className="w-full" />
          </p>
        ),
      )}
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
