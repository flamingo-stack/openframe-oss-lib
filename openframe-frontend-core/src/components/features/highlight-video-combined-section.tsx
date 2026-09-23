'use client';

import type { ReactNode } from 'react';
import { HighlightConfigSection } from './highlight-config-section';
import { HighlightGenerationSection } from './highlight-generation-section';
import { HighlightVideoPreview } from './highlight-video-preview';
import { SubtitlesEditor } from './subtitles-editor';
import type { AIRequiredField } from './ai-enrich';

export interface HighlightVideoCombinedSectionProps {
  // ===== HighlightConfigSection Props =====
  /** Target highlight duration in seconds */
  targetDurationSeconds: number;
  /** Handler for duration changes */
  onTargetDurationChange: (seconds: number) => void;
  /** Whether config section is disabled */
  configDisabled?: boolean;

  // ===== HighlightGenerationSection Props =====
  /** Handler to trigger highlight generation */
  onGenerateHighlight: () => void;
  /** Whether generation is currently processing */
  isProcessing: boolean;
  /** Whether the generate button can be clicked */
  canEnrich: boolean;
  /** Required fields to display */
  requiredFields: AIRequiredField[];
  /** Current status of the operation */
  status?: 'loading' | 'success' | 'error' | undefined;
  /** Status message to display */
  statusMessage?: string;
  /** Message shown when button is disabled */
  disabledMessage?: string;
  /** Whether cancel is available */
  showCancel?: boolean;
  /** Handler to cancel processing */
  onCancel?: () => void;
  /** Whether cancellation is in progress */
  isCancelling?: boolean;
  /** Whether result already exists (affects button label) */
  hasResult?: boolean;
  /** Custom title */
  title?: string;
  /** Custom description - if not provided, auto-generated from duration */
  description?: string;
  /** Custom button label */
  buttonLabel?: string;
  /** Custom loading label */
  loadingLabel?: string;

  // ===== HighlightVideoPreview Props =====
  /** Highlight video URL */
  highlightVideoUrl?: string | null;
  /** Video thumbnail URL */
  highlightVideoThumbnail?: string | null;
  /** Video duration in milliseconds */
  highlightVideoDurationMs?: number | null;
  /** Whether video was AI generated */
  highlightVideoSource?: 'manual' | 'ai_generated' | null;
  /** Handler to upload a new highlight video - receives File, should return uploaded URL */
  onUpload: (file: File) => Promise<string>;
  /** Handler to delete the highlight video */
  onDelete: () => Promise<void>;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Custom label for preview section */
  previewLabel?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Upload progress component (optional) */
  uploadProgressComponent?: ReactNode;

  // ===== Highlight Subtitles (SRT) Props =====
  /** Highlight captions SRT content (highlight_srt_content) */
  subtitles?: string;
  /** Callback when highlight subtitles change */
  onSubtitlesChange?: (value: string) => void;
  /** Whether the highlight subtitles were AI generated */
  isSubtitlesAIGenerated?: boolean;
  /** Video preview component - receives video data, should render the preview */
  renderVideoPreview: (props: {
    videoUrl: string;
    title: string;
    thumbnailUrl?: string;
    onDelete: () => Promise<void>;
  }) => ReactNode;

  /** Additional class name */
  className?: string;
}

/**
 * HighlightVideoCombinedSection - Unified component combining Config + AI Enrich + Preview
 *
 * This component provides a complete UI for highlight video generation with:
 * 1. HighlightConfigSection for duration and subtitle settings
 * 2. HighlightGenerationSection for triggering generation and showing status
 * 3. HighlightVideoPreview for viewing/uploading highlight videos
 *
 * Used by both CustomerInterview and ProductRelease modals.
 */
export function HighlightVideoCombinedSection({
  // Config props
  targetDurationSeconds,
  onTargetDurationChange,
  configDisabled = false,
  // Generation props
  onGenerateHighlight,
  isProcessing,
  canEnrich,
  requiredFields,
  status,
  statusMessage,
  disabledMessage = 'Upload a video and run transcription first',
  showCancel = true,
  onCancel,
  isCancelling = false,
  hasResult = false,
  title = 'Highlight Video',
  description,
  buttonLabel,
  loadingLabel = 'Generating highlight...',
  // Preview props
  highlightVideoUrl,
  highlightVideoThumbnail,
  highlightVideoDurationMs,
  highlightVideoSource,
  onUpload,
  onDelete,
  isUploading = false,
  previewLabel = 'Highlight Video',
  emptyMessage = 'No highlight video yet. Use AI generation above or upload manually.',
  uploadProgressComponent,
  // Highlight subtitles props
  subtitles,
  onSubtitlesChange,
  isSubtitlesAIGenerated = false,
  renderVideoPreview,
  // Common
  className = '',
}: HighlightVideoCombinedSectionProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* 2. AI Enrich Button Section */}
      <HighlightGenerationSection
        configSlot={
          <HighlightConfigSection
            targetDurationSeconds={targetDurationSeconds}
            onTargetDurationChange={onTargetDurationChange}
            disabled={configDisabled}
          />
        }
        targetDurationSeconds={targetDurationSeconds}
        title={title}
        description={description}
        buttonLabel={buttonLabel}
        loadingLabel={loadingLabel}
        onGenerateHighlight={onGenerateHighlight}
        isProcessing={isProcessing}
        canEnrich={canEnrich}
        requiredFields={requiredFields}
        status={status}
        statusMessage={statusMessage}
        disabledMessage={disabledMessage}
        showCancel={showCancel}
        onCancel={onCancel}
        isCancelling={isCancelling}
        hasResult={hasResult}
      />

      {/* 3. Preview + Manual Upload Section */}
      <HighlightVideoPreview
        highlightVideoUrl={highlightVideoUrl}
        highlightVideoThumbnail={highlightVideoThumbnail}
        highlightVideoDurationMs={highlightVideoDurationMs}
        highlightVideoSource={highlightVideoSource}
        onUpload={onUpload}
        onDelete={onDelete}
        isUploading={isUploading}
        previewLabel={previewLabel}
        emptyMessage={emptyMessage}
        uploadProgressComponent={uploadProgressComponent}
        renderVideoPreview={renderVideoPreview}
      />

      {/* 4. Highlight Subtitles (SRT) — the SAME SubtitlesEditor the main
          video's TranscriptSummaryEditor renders, bound to
          highlight_srt_content instead of srt_content. */}
      <SubtitlesEditor
        id="highlight-subtitles"
        subtitles={subtitles}
        onSubtitlesChange={onSubtitlesChange}
        label="Highlight Subtitles (SRT)"
        helperText="SRT captions transcribed from the highlight reel (AssemblyAI). Served as a selectable text track on the highlight player. Editable for fine-tuning."
        isAIGenerated={isSubtitlesAIGenerated}
      />
    </div>
  );
}

export default HighlightVideoCombinedSection;
