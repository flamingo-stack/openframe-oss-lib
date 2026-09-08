'use client';

import { Sparkles, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { AIGeneratedBadge } from '../ui/ai-generated-badge';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { AIEnrichSection } from './ai-enrich';
import type { AIRequiredField } from './ai-enrich';
import { HighlightConfigSection } from './highlight-config-section';
import { SubtitlesEditor } from './subtitles-editor';

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
 * 2. AIEnrichSection for triggering generation and showing status
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
  const defaultButtonLabel = hasResult ? 'Regenerate Highlight' : 'Generate Highlight';
  const defaultDescription = `Generate a ${Math.floor(targetDurationSeconds / 60)}-minute summary video using Claude AI + Shotstack`;

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      await onUpload(file);
    };
    input.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 2. AI Enrich Button Section */}
      <AIEnrichSection
        configSlot={
          <HighlightConfigSection
            targetDurationSeconds={targetDurationSeconds}
            onTargetDurationChange={onTargetDurationChange}
            disabled={configDisabled}
          />
        }
        title={title}
        description={description || defaultDescription}
        icon={<Sparkles className="h-5 w-5" />}
        buttonLabel={buttonLabel || defaultButtonLabel}
        loadingLabel={loadingLabel}
        onEnrich={onGenerateHighlight}
        loading={isProcessing}
        canEnrich={canEnrich}
        requiredFields={requiredFields}
        status={status}
        statusMessage={statusMessage}
        disabledMessage={disabledMessage}
        showCancel={showCancel}
        onCancel={onCancel}
        isCancelling={isCancelling}
      />

      {/* 3. Preview + Manual Upload Section */}
      <div className="space-y-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label>{previewLabel}</Label>
            {highlightVideoSource === 'ai_generated' && <AIGeneratedBadge />}
            {highlightVideoDurationMs && (
              <Badge variant="outline" className="text-h6">
                {formatDuration(highlightVideoDurationMs)}
              </Badge>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="small-legacy"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Highlight'}
          </Button>
        </div>

        {uploadProgressComponent}

        {highlightVideoUrl ? (
          renderVideoPreview({
            videoUrl: highlightVideoUrl,
            title: 'Highlight Video',
            thumbnailUrl: highlightVideoThumbnail || undefined,
            onDelete,
          })
        ) : (
          <p className="italic text-ods-text-secondary text-h6">{emptyMessage}</p>
        )}
      </div>

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
