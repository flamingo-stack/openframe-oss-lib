'use client';

import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import type React from 'react';
import { cn } from '../../../utils/cn';
import { SparklesIcon } from '../../icons/sparkles-icon';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { AIEnrichButton } from './AIEnrichButton';
import { AIWarningsSection } from './AIWarningsSection';

export interface ConfidenceField {
  label: string;
  key: string;
  confidence?: number;
}

/**
 * Represents a field required for AI enrichment.
 * Used to drive both the canEnrich logic and display of AI-required badges.
 */
export interface AIRequiredField {
  /** Form field key (e.g., 'version', 'email') */
  key: string;
  /** Display label (e.g., 'Version', 'Email') */
  label: string;
  /** Current state - is field filled? */
  isFilled: boolean;
}

export interface AIEnrichSectionProps {
  // Button state
  onEnrich: () => void;
  loading?: boolean;
  disabled?: boolean;
  canEnrich?: boolean;

  // Status
  status?: 'idle' | 'loading' | 'success' | 'error';
  statusMessage?: string;
  overallConfidence?: number;

  // Warnings
  warnings?: string[];

  // Confidence fields to display (optional - shown as simple list)
  confidenceFields?: ConfidenceField[];

  // Required fields for AI enrichment - displays missing fields when disabled
  requiredFields?: AIRequiredField[];

  // Custom content (like created tags info)
  children?: React.ReactNode;
  /**
   * Settings panel rendered INSIDE the card, between the header and the action
   * button (same slot the custom-instructions block occupies). Combined
   * sections (clips, highlight) pass their config here so it sits under the
   * title that names it — rendered ABOVE the card, a config panel reads as
   * belonging to whatever section happens to precede it.
   */
  configSlot?: React.ReactNode;

  // Actions
  onClear?: () => void;
  showClearButton?: boolean;
  onCancel?: () => void;
  showCancel?: boolean;
  isCancelling?: boolean;

  // Labels
  title?: string;
  description?: string;
  buttonLabel?: string;
  loadingLabel?: string;
  disabledMessage?: string;

  // Styling
  variant?: 'default' | 'compact';
  className?: string;
  icon?: React.ReactNode;

  // Editor-provided custom instructions textarea (opt-in).
  // When showCustomInstructions is true, a controlled <Textarea> is rendered
  // above the action button. The parent owns the string — purely controlled.
  // The same value is sent to the backend and injected into the Claude prompt
  // via lib/utils/ai-instructions.ts → buildEditorFocusBlock().
  showCustomInstructions?: boolean;
  customInstructions?: string;
  onCustomInstructionsChange?: (value: string) => void;
  customInstructionsLabel?: string;
  customInstructionsPlaceholder?: string;
  customInstructionsHelperText?: string;
  customInstructionsMaxLength?: number;
}

export const AIEnrichSection: React.FC<AIEnrichSectionProps> = ({
  onEnrich,
  loading = false,
  disabled = false,
  canEnrich = true,
  status,
  statusMessage,
  overallConfidence,
  warnings,
  requiredFields,
  children,
  configSlot,
  onClear,
  showClearButton = true,
  onCancel,
  showCancel = false,
  isCancelling = false,
  title = 'AI Enrichment',
  description,
  buttonLabel = 'AI Enrich',
  loadingLabel = 'Enriching...',
  disabledMessage = 'Fill in required fields to enable AI enrichment.',
  variant = 'default',
  className,
  icon,
  showCustomInstructions = false,
  customInstructions,
  onCustomInstructionsChange,
  customInstructionsLabel = 'Focus / additional instructions',
  customInstructionsPlaceholder = "Optional — steer the AI. e.g. 'Lead with the new SSO + audit log features; downplay the minor UI tweaks.'",
  customInstructionsHelperText,
  customInstructionsMaxLength = 5000,
}) => {
  const hasResults = status === 'success' || status === 'error';
  const shouldDisable = disabled || !canEnrich;

  // Get list of unfilled required fields for display
  const unfilledFields = requiredFields?.filter(f => !f.isFilled) || [];

  return (
    <div
      className={cn(
        'rounded-lg border border-ods-border bg-ods-card',
        variant === 'default' ? 'space-y-4 p-6' : 'space-y-3 p-4',
        className,
      )}
    >
      {/* Row 1: Icon + Title + Description */}
      <div className="flex items-center gap-3">
        {icon || <SparklesIcon size={20} className="text-ods-text-secondary" />}
        <div className="flex-1">
          <h3 className="text-ods-text-primary text-h5">{title}</h3>
          {description && <p className="mt-1 text-ods-text-secondary text-h6">{description}</p>}
        </div>
      </div>

      {/* Editor-provided settings (opt-in) — e.g. clip aspect ratio, highlight duration */}
      {configSlot}

      {/* Editor-provided custom instructions (opt-in) */}
      {showCustomInstructions && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="ai-enrich-custom-instructions" className="text-ods-text-primary text-h6">
              {customInstructionsLabel}
            </label>
            {customInstructionsMaxLength !== undefined && (
              <span className="text-ods-text-secondary text-h6">
                {(customInstructions ?? '').length}/{customInstructionsMaxLength}
              </span>
            )}
          </div>
          <Textarea
            id="ai-enrich-custom-instructions"
            value={customInstructions ?? ''}
            onChange={e => onCustomInstructionsChange?.(e.target.value)}
            placeholder={customInstructionsPlaceholder}
            disabled={loading}
            maxLength={customInstructionsMaxLength}
            rows={3}
            className="resize-y"
          />
          {customInstructionsHelperText && (
            <p className="text-ods-text-secondary text-h6">{customInstructionsHelperText}</p>
          )}
        </div>
      )}

      {/* Row 2: Buttons */}
      <div className="flex flex-col gap-3">
        <AIEnrichButton
          onClick={() => {
            console.log('[AIEnrichSection] 🔘 Button clicked');
            console.log('[AIEnrichSection] Loading:', loading);
            console.log('[AIEnrichSection] Disabled:', shouldDisable);
            console.log('[AIEnrichSection] CanEnrich:', canEnrich);
            onEnrich();
          }}
          loading={loading}
          disabled={shouldDisable}
          label={buttonLabel}
          loadingLabel={loadingLabel}
          size="md"
          className="!w-full"
        />
        {showCancel && onCancel && loading && (
          <Button
            type="button"
            variant="outline"
            size="small-legacy"
            onClick={onCancel}
            disabled={isCancelling}
            leftIcon={isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            className="!w-full"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel Processing'}
          </Button>
        )}
      </div>

      {/* Disabled message with unfilled fields */}
      {shouldDisable && !loading && (
        <div className="space-y-2">
          <p className="text-ods-text-secondary text-h6">{disabledMessage}</p>
          {unfilledFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unfilledFields.map(field => (
                <span
                  key={field.key}
                  className="inline-flex items-center gap-1 rounded-full bg-ods-flamingo-cyan/10 px-2 py-0.5 text-ods-flamingo-cyan/70 text-h6"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-ods-flamingo-cyan/50" />
                  {field.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading state with status message */}
      {loading && statusMessage && (
        <div className="flex items-center gap-3 rounded-lg bg-ods-bg-surface p-3">
          <Loader2 className="h-5 w-5 animate-spin text-ods-accent" />
          <span className="text-ods-text-primary text-h6">{statusMessage}</span>
        </div>
      )}

      {/* Results section */}
      {hasResults && (
        <div className="space-y-4">
          {/* Status indicator - simple and clean */}
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg p-3',
              status === 'success' ? 'bg-ods-success/10' : 'bg-ods-error/10',
            )}
          >
            {status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-ods-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-ods-error" />
            )}
            <span className={cn('text-h6', status === 'success' ? 'text-ods-success' : 'text-ods-error')}>
              {statusMessage || (status === 'success' ? 'Enrichment complete' : 'Enrichment failed')}
            </span>
            {overallConfidence !== undefined && status === 'success' && (
              <Badge variant="success" className="ml-auto">
                {overallConfidence}% confidence
              </Badge>
            )}
          </div>

          {/* Warnings */}
          {warnings && warnings.length > 0 && <AIWarningsSection warnings={warnings} />}

          {/* Custom children content (like created tags info) */}
          {children}

          {/* Clear button */}
          {showClearButton && onClear && (
            <Button type="button" variant="outline" size="small-legacy" onClick={onClear}>
              Clear Results
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
