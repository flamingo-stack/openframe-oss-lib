'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import { SparklesIcon } from '../../icons/sparkles-icon'
import { AIEnrichButton } from './AIEnrichButton'
import { AIWarningsSection } from './AIWarningsSection'
import { Button } from '../../ui/button'
import { Badge } from '../../ui/badge'
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'

export interface ConfidenceField {
  label: string
  key: string
  confidence?: number
}

/**
 * Represents a field required for AI enrichment.
 * Used to drive both the canEnrich logic and display of AI-required badges.
 */
export interface AIRequiredField {
  /** Form field key (e.g., 'version', 'email') */
  key: string
  /** Display label (e.g., 'Version', 'Email') */
  label: string
  /** Current state - is field filled? */
  isFilled: boolean
}

export interface AIEnrichSectionProps {
  // Button state
  onEnrich: () => void
  loading?: boolean
  disabled?: boolean
  canEnrich?: boolean

  // Status
  status?: 'idle' | 'loading' | 'success' | 'error'
  statusMessage?: string
  overallConfidence?: number

  // Warnings
  warnings?: string[]

  // Confidence fields to display (optional - shown as simple list)
  confidenceFields?: ConfidenceField[]

  // Required fields for AI enrichment - displays missing fields when disabled
  requiredFields?: AIRequiredField[]

  // Custom content (like created tags info)
  children?: React.ReactNode

  // Actions
  onClear?: () => void
  showClearButton?: boolean
  onCancel?: () => void
  showCancel?: boolean
  isCancelling?: boolean

  // Labels
  title?: string
  description?: string
  buttonLabel?: string
  loadingLabel?: string
  disabledMessage?: string

  // Styling
  variant?: 'default' | 'compact'
  className?: string
  icon?: React.ReactNode
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
  confidenceFields,
  requiredFields,
  children,
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
}) => {
  const hasResults = status === 'success' || status === 'error'
  const shouldDisable = disabled || !canEnrich

  // Get list of unfilled required fields for display
  const unfilledFields = requiredFields?.filter(f => !f.isFilled) || []

  return (
    <div
      className={cn(
        'rounded-lg bg-ods-card border border-ods-border',
        variant === 'default' ? 'p-6 space-y-4' : 'p-4 space-y-3',
        className
      )}
    >
      {/* Row 1: Icon + Title + Description */}
      <div className="flex items-center gap-3">
        {icon || <SparklesIcon size={20} className="text-ods-text-secondary" />}
        <div className="flex-1">
          <h3 className="font-['Azeret_Mono'] text-[18px] font-semibold uppercase text-ods-text-primary">
            {title}
          </h3>
          {description && (
            <p className="text-ods-text-secondary text-sm font-['DM_Sans'] mt-1">
              {description}
            </p>
          )}
        </div>
      </div>

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
            variant="outline"
            size="sm"
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
          <p className="text-ods-text-secondary text-sm font-['DM_Sans']">
            {disabledMessage}
          </p>
          {unfilledFields.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {unfilledFields.map(field => (
                <span
                  key={field.key}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[--ods-flamingo-cyan-base]/10 text-[--ods-flamingo-cyan-base]/70 font-['DM_Sans']"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[--ods-flamingo-cyan-base]/50" />
                  {field.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading state with status message */}
      {loading && statusMessage && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-ods-card-secondary">
          <Loader2 className="h-5 w-5 text-ods-accent animate-spin" />
          <span className="text-sm text-ods-text-primary font-['DM_Sans']">
            {statusMessage}
          </span>
        </div>
      )}

      {/* Results section */}
      {hasResults && (
        <div className="space-y-4">
          {/* Status indicator - simple and clean */}
          <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg',
            status === 'success' ? 'bg-[--ods-attention-green-success]/10' : 'bg-[--ods-attention-red-error]/10'
          )}>
            {status === 'success' ? (
              <CheckCircle className="h-5 w-5 text-[--ods-attention-green-success]" />
            ) : (
              <AlertCircle className="h-5 w-5 text-[--ods-attention-red-error]" />
            )}
            <span className={cn(
              'text-sm font-medium',
              status === 'success' ? 'text-[--ods-attention-green-success]' : 'text-[--ods-attention-red-error]'
            )}>
              {statusMessage || (status === 'success' ? 'Enrichment complete' : 'Enrichment failed')}
            </span>
            {overallConfidence !== undefined && status === 'success' && (
              <Badge variant="success" className="ml-auto">
                {overallConfidence}% confidence
              </Badge>
            )}
          </div>

          {/* Warnings */}
          {warnings && warnings.length > 0 && (
            <AIWarningsSection warnings={warnings} />
          )}

          {/* Custom children content (like created tags info) */}
          {children}

          {/* Clear button */}
          {showClearButton && onClear && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
            >
              Clear Results
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
