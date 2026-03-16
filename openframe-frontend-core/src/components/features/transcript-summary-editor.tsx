"use client";

import React from 'react';
import { Sparkles } from 'lucide-react';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { ConfidenceBadge } from './ai-enrich/ConfidenceBadge';

export interface TranscriptSummaryEditorProps {
  /** Video summary text value - AI-generated from video transcription (defaults to empty string if undefined) */
  videoSummary?: string;
  /** Callback when video summary changes */
  onVideoSummaryChange: (value: string) => void;
  /** Transcript text value (defaults to empty string if undefined) */
  transcript?: string;
  /** Callback when transcript changes */
  onTranscriptChange: (value: string) => void;
  /** Whether content was AI generated */
  isAIGenerated?: boolean;
  /** Confidence score for video summary (0-100) */
  videoSummaryConfidence?: number | null;
  /** Confidence score for transcript (0-100) */
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
  /** Minimum height for video summary textarea */
  videoSummaryMinHeight?: number;
  /** Minimum height for transcript textarea */
  transcriptMinHeight?: number;
  /** Whether the fields are disabled */
  disabled?: boolean;
  /** Additional class name for the container */
  className?: string;
}

/**
 * TranscriptSummaryEditor - Unified component for editing transcript and summary with AI badges
 *
 * This component provides a consistent UI for both CustomerInterview and ProductRelease entities,
 * showing AI generation badges and confidence scores when applicable.
 */
export function TranscriptSummaryEditor({
  videoSummary = '',
  onVideoSummaryChange,
  transcript = '',
  onTranscriptChange,
  isAIGenerated = false,
  videoSummaryConfidence,
  transcriptConfidence,
  videoSummaryLabel = 'Video Summary (Markdown supported)',
  videoSummaryHelperText = 'AI-generated summary from video content.',
  videoSummaryPlaceholder = 'Brief summary of the video content...',
  transcriptLabel = 'Transcript',
  transcriptHelperText = 'Full transcript with speaker diarization and timestamps',
  transcriptPlaceholder = '**[00:00] Speaker Name:** Text here...',
  videoSummaryMinHeight = 200,
  transcriptMinHeight = 300,
  disabled = false,
  className = '',
}: TranscriptSummaryEditorProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Video Summary Editor */}
      <div>
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="video-summary">{videoSummaryLabel}</Label>
            {isAIGenerated && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </Badge>
            )}
            {videoSummaryConfidence !== undefined && videoSummaryConfidence !== null && (
              <ConfidenceBadge
                confidence={videoSummaryConfidence}
                showLabel={true}
                showPercentage={true}
                size="sm"
              />
            )}
          </div>
          <p className="text-xs text-ods-text-secondary mt-1">{videoSummaryHelperText}</p>
        </div>
        <div
          className="rounded-lg border border-ods-border bg-ods-background-secondary overflow-hidden"
          style={{ minHeight: `${videoSummaryMinHeight}px` }}
        >
          <Textarea
            id="video-summary"
            value={videoSummary}
            onChange={(e) => onVideoSummaryChange(e.target.value)}
            placeholder={videoSummaryPlaceholder}
            disabled={disabled}
            className="h-full w-full resize-none border-0 bg-transparent text-ods-text-primary placeholder:text-ods-text-secondary/50 focus:ring-0 focus:outline-none p-4 font-mono text-sm"
            style={{ minHeight: `${videoSummaryMinHeight}px`, lineHeight: '1.6' }}
          />
        </div>
      </div>

      {/* Transcript Editor */}
      <div>
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="transcript">{transcriptLabel}</Label>
            {isAIGenerated && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI Generated
              </Badge>
            )}
            {transcriptConfidence !== undefined && transcriptConfidence !== null && (
              <ConfidenceBadge
                confidence={transcriptConfidence}
                showLabel={true}
                showPercentage={true}
                size="sm"
              />
            )}
          </div>
          <p className="text-xs text-ods-text-secondary mt-1">{transcriptHelperText}</p>
        </div>
        <div
          className="rounded-lg border border-ods-border bg-ods-background-secondary overflow-hidden"
          style={{ minHeight: `${transcriptMinHeight}px` }}
        >
          <Textarea
            id="transcript"
            value={transcript}
            onChange={(e) => onTranscriptChange(e.target.value)}
            placeholder={transcriptPlaceholder}
            disabled={disabled}
            className="h-full w-full resize-none border-0 bg-transparent text-ods-text-primary placeholder:text-ods-text-secondary/50 focus:ring-0 focus:outline-none p-4 font-mono text-sm"
            style={{ minHeight: `${transcriptMinHeight}px`, lineHeight: '1.6' }}
          />
        </div>
      </div>
    </div>
  );
}

export default TranscriptSummaryEditor;
