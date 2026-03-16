"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { AIEnrichSection } from './ai-enrich';
import type { AIRequiredField } from './ai-enrich';

export interface VideoClipsSectionProps {
  /** Handler to trigger video clips extraction */
  onExtractClips: () => void;
  /** Whether extraction is currently processing */
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
  /** Custom description */
  description?: string;
  /** Custom button label */
  buttonLabel?: string;
  /** Custom loading label */
  loadingLabel?: string;
}

/**
 * VideoClipsSection - Unified AIEnrichSection wrapper for video clips extraction
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities
 * for the "Video Clips" extraction step. Use with VideoBitesEditor for the full experience.
 */
export function VideoClipsSection({
  onExtractClips,
  isProcessing,
  canEnrich,
  requiredFields,
  status,
  statusMessage,
  disabledMessage = "Upload a video first",
  showCancel = true,
  onCancel,
  isCancelling = false,
  hasResult = false,
  title = "Video Clips",
  description = "Extract marketing-ready video clips from the video",
  buttonLabel,
  loadingLabel = "Extracting clips...",
}: VideoClipsSectionProps) {
  const defaultButtonLabel = hasResult ? "Regenerate Clips" : "Generate Clips";

  return (
    <AIEnrichSection
      title={title}
      description={description}
      icon={<Sparkles className="h-5 w-5" />}
      buttonLabel={buttonLabel || defaultButtonLabel}
      loadingLabel={loadingLabel}
      onEnrich={onExtractClips}
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
  );
}

export default VideoClipsSection;
