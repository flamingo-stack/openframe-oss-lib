"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { AIEnrichSection } from './ai-enrich';
import type { AIRequiredField } from './ai-enrich';

export interface TranscribeSummarizeSectionProps {
  /** Handler to trigger transcription processing */
  onTranscribe: () => void;
  /** Whether transcription is currently processing */
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
 * TranscribeSummarizeSection - Unified AIEnrichSection wrapper for video transcription
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities
 * for the "Transcribe & Summarize" video processing step.
 */
export function TranscribeSummarizeSection({
  onTranscribe,
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
  title = "Transcribe & Summarize",
  description = "Generate transcript with speaker diarization and AI summary",
  buttonLabel,
  loadingLabel = "Processing...",
}: TranscribeSummarizeSectionProps) {
  const defaultButtonLabel = hasResult ? "Regenerate" : "Generate";

  return (
    <AIEnrichSection
      title={title}
      description={description}
      icon={<Sparkles className="h-5 w-5" />}
      buttonLabel={buttonLabel || defaultButtonLabel}
      loadingLabel={loadingLabel}
      onEnrich={onTranscribe}
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

export default TranscribeSummarizeSection;
