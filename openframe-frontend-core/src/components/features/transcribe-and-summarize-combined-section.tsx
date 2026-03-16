"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { AIEnrichSection } from './ai-enrich';
import { TranscriptSummaryEditor } from './transcript-summary-editor';
import type { AIRequiredField } from './ai-enrich';

export interface TranscribeAndSummarizeCombinedSectionProps {
  // ===== AIEnrichSection Props =====
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
  /** Custom button label */
  buttonLabel?: string;
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Custom loading label */
  loadingLabel?: string;

  // ===== TranscriptSummaryEditor Props =====
  /** Video summary text */
  videoSummary?: string;
  /** Handler for video summary changes */
  onVideoSummaryChange: (value: string) => void;
  /** Transcript text */
  transcript?: string;
  /** Handler for transcript changes */
  onTranscriptChange: (value: string) => void;
  /** Whether content was AI generated */
  isAIGenerated?: boolean;
  /** Confidence score for video summary */
  videoSummaryConfidence?: number | null;
  /** Confidence score for transcript */
  transcriptConfidence?: number | null;
  /** Custom label for video summary field */
  videoSummaryLabel?: string;
  /** Custom helper text for video summary */
  videoSummaryHelperText?: string;
  /** Custom placeholder for video summary */
  videoSummaryPlaceholder?: string;
  /** Custom label for transcript field */
  transcriptLabel?: string;
  /** Custom helper text for transcript */
  transcriptHelperText?: string;
  /** Custom placeholder for transcript */
  transcriptPlaceholder?: string;
  /** Minimum height for transcript textarea */
  transcriptMinHeight?: number;
  /** Whether fields are disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * TranscribeAndSummarizeCombinedSection - Unified component combining AI Enrich button + Transcript/Summary editor
 *
 * This component provides a complete UI for video transcription with:
 * 1. AIEnrichSection for triggering transcription and showing status
 * 2. TranscriptSummaryEditor for displaying/editing the video summary and transcript
 *
 * Used by both CustomerInterview and ProductRelease modals.
 */
export function TranscribeAndSummarizeCombinedSection({
  // AIEnrichSection props
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
  buttonLabel,
  title = "Transcribe & Summarize",
  description = "Generate transcript with speaker diarization and AI summary",
  loadingLabel = "Processing...",
  // TranscriptSummaryEditor props
  videoSummary = '',
  onVideoSummaryChange,
  transcript = '',
  onTranscriptChange,
  isAIGenerated = false,
  videoSummaryConfidence,
  transcriptConfidence,
  videoSummaryLabel = "Video Summary (Markdown supported)",
  videoSummaryHelperText = "AI-generated summary from video content.",
  videoSummaryPlaceholder = "Summary of the video content...",
  transcriptLabel = "Video Transcript",
  transcriptHelperText = "Full video transcript with speaker diarization and timestamps",
  transcriptPlaceholder = "**[00:00] Speaker Name:** Text here...",
  transcriptMinHeight,
  disabled = false,
  className = '',
}: TranscribeAndSummarizeCombinedSectionProps) {
  const defaultButtonLabel = hasResult ? "Regenerate" : "Generate";

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. AI Enrich Button Section */}
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

      {/* 2. Transcript & Summary Editor */}
      <TranscriptSummaryEditor
        videoSummary={videoSummary}
        onVideoSummaryChange={onVideoSummaryChange}
        transcript={transcript}
        onTranscriptChange={onTranscriptChange}
        isAIGenerated={isAIGenerated}
        videoSummaryConfidence={videoSummaryConfidence}
        transcriptConfidence={transcriptConfidence}
        videoSummaryLabel={videoSummaryLabel}
        videoSummaryHelperText={videoSummaryHelperText}
        videoSummaryPlaceholder={videoSummaryPlaceholder}
        transcriptLabel={transcriptLabel}
        transcriptHelperText={transcriptHelperText}
        transcriptPlaceholder={transcriptPlaceholder}
        transcriptMinHeight={transcriptMinHeight}
        disabled={disabled}
      />
    </div>
  );
}

export default TranscribeAndSummarizeCombinedSection;
