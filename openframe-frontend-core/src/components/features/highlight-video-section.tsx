"use client";

import React, { useState } from 'react';
import { Sparkles, Upload } from 'lucide-react';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AIEnrichSection } from './ai-enrich/AIEnrichSection';
import type { AIRequiredField } from './ai-enrich/AIEnrichSection';

export interface HighlightVideoSectionProps {
  /** Current highlight video URL */
  highlightVideoUrl?: string | null;
  /** Highlight video thumbnail URL */
  highlightVideoThumbnail?: string | null;
  /** Highlight video duration in milliseconds */
  highlightVideoDurationMs?: number | null;
  /** Highlight video source type */
  highlightVideoSource?: 'manual' | 'ai_generated' | null;
  /** Target duration in seconds for AI generation */
  targetDurationSeconds: number;
  /** Callback when target duration changes */
  onTargetDurationChange: (seconds: number) => void;
  /** Whether to skip subtitle burning */
  skipSubtitleBurning: boolean;
  /** Callback when skip subtitle option changes */
  onSkipSubtitleBurningChange: (skip: boolean) => void;
  /** Callback to trigger highlight generation */
  onGenerateHighlight: () => void;
  /** Whether highlight generation is in progress */
  isGenerating?: boolean;
  /** Progress percentage for generation (0-100) */
  generationProgress?: number;
  /** Status message during generation */
  generationStatusMessage?: string;
  /** Generation status (cancelled maps to error) */
  generationStatus?: 'idle' | 'loading' | 'success' | 'error';
  /** Whether highlight can be generated */
  canGenerateHighlight?: boolean;
  /** Required fields for generation */
  requiredFields?: AIRequiredField[];
  /** Message when generation is disabled */
  disabledMessage?: string;
  /** Whether a previous highlight exists */
  hasExistingHighlight?: boolean;
  /** Callback to cancel generation */
  onCancelGeneration?: () => void;
  /** Whether cancellation is in progress */
  isCancelling?: boolean;
  /** Callback to upload highlight video manually */
  onUploadHighlight: (file: File) => Promise<string>;
  /** Whether upload is in progress */
  isUploading?: boolean;
  /** Callback when highlight video is deleted */
  onDeleteHighlight?: () => void;
  /** Custom video preview component */
  VideoPreviewComponent?: React.ComponentType<{
    videoUrl: string;
    thumbnailUrl?: string;
    onDelete?: () => void;
  }>;
  /** Whether section is disabled (e.g., YouTube selected) */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * HighlightVideoSection - Unified component for highlight video generation and management
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities,
 * including duration configuration, AI generation trigger, manual upload, and video preview.
 */
export function HighlightVideoSection({
  highlightVideoUrl,
  highlightVideoThumbnail,
  highlightVideoDurationMs,
  highlightVideoSource,
  targetDurationSeconds,
  onTargetDurationChange,
  skipSubtitleBurning,
  onSkipSubtitleBurningChange,
  onGenerateHighlight,
  isGenerating = false,
  generationProgress,
  generationStatusMessage,
  generationStatus,
  canGenerateHighlight = true,
  requiredFields = [],
  disabledMessage = 'Upload a video and run transcription first',
  hasExistingHighlight = false,
  onCancelGeneration,
  isCancelling = false,
  onUploadHighlight,
  isUploading = false,
  onDeleteHighlight,
  VideoPreviewComponent,
  disabled = false,
  className = '',
}: HighlightVideoSectionProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      setUploadError(null);
      try {
        await onUploadHighlight(file);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Failed to upload video');
      }
    };
    input.click();
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Highlight Video Configuration */}
      <div className="space-y-3 p-4 bg-ods-background-secondary rounded-lg border border-ods-border">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-sm">Target Duration</Label>
            <Select
              value={targetDurationSeconds.toString()}
              onValueChange={(value) => onTargetDurationChange(parseInt(value))}
              disabled={disabled}
            >
              <SelectTrigger className="bg-ods-background-tertiary mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-ods-card">
                <SelectItem value="60">1 minute</SelectItem>
                <SelectItem value="120">2 minutes</SelectItem>
                <SelectItem value="180">3 minutes (Recommended)</SelectItem>
                <SelectItem value="240">4 minutes</SelectItem>
                <SelectItem value="300">5 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="skipSubtitleBurning"
              checked={skipSubtitleBurning}
              onChange={(e) => onSkipSubtitleBurningChange(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-ods-border bg-ods-background-tertiary text-ods-accent focus:ring-ods-accent"
            />
            <Label htmlFor="skipSubtitleBurning" className="text-sm cursor-pointer">
              Skip subtitle burning
            </Label>
          </div>
        </div>
      </div>

      {/* AI Generation Section */}
      <AIEnrichSection
        title="Highlight Video"
        description={`Generate a ${Math.floor(targetDurationSeconds / 60)}-minute summary video using Claude AI + Shotstack`}
        icon={<Sparkles className="h-5 w-5" />}
        buttonLabel={hasExistingHighlight ? "Regenerate Highlight" : "Generate Highlight"}
        loadingLabel="Generating highlight..."
        onEnrich={onGenerateHighlight}
        loading={isGenerating}
        canEnrich={canGenerateHighlight && !disabled}
        requiredFields={requiredFields}
        status={generationStatus}
        statusMessage={
          generationStatusMessage ?
            (generationProgress && generationProgress > 0 ? `${generationStatusMessage} (${generationProgress}%)` : generationStatusMessage) :
          undefined
        }
        disabledMessage={disabled ? "Switch to 'Upload Video' to enable AI processing" : disabledMessage}
        showCancel={!!onCancelGeneration}
        onCancel={onCancelGeneration}
        isCancelling={isCancelling}
      />

      {/* Highlight Video Preview + Manual Upload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Label>Highlight Video</Label>
            {highlightVideoSource === 'ai_generated' && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </Badge>
            )}
            {highlightVideoDurationMs && (
              <Badge variant="outline" className="text-xs">
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
            disabled={isUploading || disabled}
          >
            {isUploading ? 'Uploading...' : 'Upload Highlight'}
          </Button>
        </div>

        {uploadError && (
          <p className="text-sm text-ods-attention-red-error">{uploadError}</p>
        )}

        {highlightVideoUrl ? (
          VideoPreviewComponent ? (
            <VideoPreviewComponent
              videoUrl={highlightVideoUrl}
              thumbnailUrl={highlightVideoThumbnail || undefined}
              onDelete={onDeleteHighlight}
            />
          ) : (
            // Default simple preview
            <div className="relative rounded-lg border border-ods-border overflow-hidden bg-black">
              <video
                src={highlightVideoUrl}
                poster={highlightVideoThumbnail || undefined}
                className="w-full h-auto max-h-[300px] object-contain"
                controls
              />
              {onDeleteHighlight && (
                <button
                  type="button"
                  onClick={onDeleteHighlight}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full transition-colors"
                >
                  <span className="sr-only">Delete</span>
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )
        ) : (
          <p className="text-sm text-ods-text-secondary italic">
            No highlight video yet. Use AI generation above or upload manually.
          </p>
        )}
      </div>
    </div>
  );
}

export default HighlightVideoSection;
