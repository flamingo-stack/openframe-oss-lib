"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { AIEnrichSection } from './ai-enrich';
import type { AIRequiredField } from './ai-enrich';

export interface HighlightGenerationSectionProps {
  /** Handler to trigger highlight video generation */
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
  /** Target highlight duration in seconds (for description) */
  targetDurationSeconds?: number;
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
 * HighlightGenerationSection - Unified AIEnrichSection wrapper for highlight video generation
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities
 * for the "Highlight Video" generation step. Use with HighlightConfigSection for the full experience.
 */
export function HighlightGenerationSection({
  onGenerateHighlight,
  isProcessing,
  canEnrich,
  requiredFields,
  status,
  statusMessage,
  disabledMessage = "Upload a video and run transcription first",
  showCancel = true,
  onCancel,
  isCancelling = false,
  hasResult = false,
  targetDurationSeconds = 180,
  title = "Highlight Video",
  description,
  buttonLabel,
  loadingLabel = "Generating highlight...",
}: HighlightGenerationSectionProps) {
  const defaultButtonLabel = hasResult ? "Regenerate Highlight" : "Generate Highlight";
  const defaultDescription = `Generate a ${Math.floor(targetDurationSeconds / 60)}-minute summary video using Claude AI + Shotstack`;

  return (
    <AIEnrichSection
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
  );
}

export default HighlightGenerationSection;
