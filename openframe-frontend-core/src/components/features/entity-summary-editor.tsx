'use client';

import { AIGeneratedBadge } from '../ui/ai-generated-badge';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ConfidenceBadge } from './ai-enrich/ConfidenceBadge';

export interface EntitySummaryEditorProps {
  /** Summary text value (defaults to empty string if undefined) */
  summary?: string;
  /** Callback when summary changes */
  onSummaryChange: (value: string) => void;
  /** Whether content was AI generated */
  isAIGenerated?: boolean;
  /** Confidence score for summary (0-100) */
  summaryConfidence?: number | null;
  /** Custom label for summary field */
  label?: string;
  /** Custom helper text */
  helperText?: string;
  /** Custom placeholder */
  placeholder?: string;
  /** Minimum height for textarea */
  minHeight?: number;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional class name for the container */
  className?: string;
}

/**
 * EntitySummaryEditor - Unified component for editing entity summaries with AI badges
 *
 * This component provides a consistent UI for entity summaries (e.g., Release Summary, Interview Summary)
 * separate from video summaries. Shows AI generation badges and confidence scores when applicable.
 */
export function EntitySummaryEditor({
  summary = '',
  onSummaryChange,
  isAIGenerated = false,
  summaryConfidence,
  label = 'Summary (Markdown supported)',
  helperText = 'Entity summary. Displayed on cards and detail page.',
  placeholder = 'Brief summary...',
  minHeight = 200,
  disabled = false,
  className = '',
}: EntitySummaryEditorProps) {
  return (
    <div className={className}>
      <div className="mb-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="entity-summary">{label}</Label>
          {isAIGenerated && <AIGeneratedBadge />}
          {summaryConfidence !== undefined && summaryConfidence !== null && (
            <ConfidenceBadge confidence={summaryConfidence} showLabel={true} showPercentage={true} size="sm" />
          )}
        </div>
        <p className="mt-1 text-ods-text-secondary text-h6">{helperText}</p>
      </div>
      <div
        className="overflow-hidden rounded-lg border border-ods-border bg-ods-card"
        style={{ minHeight: `${minHeight}px` }}
      >
        <Textarea
          id="entity-summary"
          value={summary}
          onChange={e => onSummaryChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-full w-full resize-none border-0 bg-transparent p-4 text-ods-text-primary text-code placeholder:text-ods-text-secondary/50 focus:outline-none focus:ring-0"
          style={{ minHeight: `${minHeight}px`, lineHeight: '1.6' }}
        />
      </div>
    </div>
  );
}

export default EntitySummaryEditor;
