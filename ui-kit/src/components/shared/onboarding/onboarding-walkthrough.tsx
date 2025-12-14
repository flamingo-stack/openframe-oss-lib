'use client'

import React, { useRef, useCallback } from 'react'
import { Button } from '../../ui/button'
import { OnboardingStepCard } from './onboarding-step-card'
import { useOnboardingState, type OnboardingStepConfig } from '../../../hooks/ui/use-onboarding-state'
import { cn } from '../../../utils/cn'

export interface OnboardingWalkthroughProps {
  steps: OnboardingStepConfig[]
  onDismiss?: () => void
  storageKey?: string
  className?: string
  spacing?: string
  /**
   * Completion status from hook-based checks (e.g., useOnboardingCompletion)
   * Object mapping step IDs to boolean completion status
   */
  completionStatus?: Record<string, boolean>
  /**
   * Whether completion checks are still loading
   */
  isLoadingCompletion?: boolean
}

export function OnboardingWalkthrough({
  steps,
  onDismiss,
  storageKey = 'openframe-onboarding-state',
  className,
  spacing = 'space-y-4',
  completionStatus,
  isLoadingCompletion = false
}: OnboardingWalkthroughProps) {
  const {
    state,
    markComplete,
    markSkipped,
    dismissOnboarding,
    isStepComplete,
    isStepSkipped,
    allStepsComplete,
    markMultipleComplete
  } = useOnboardingState(storageKey)

  // Refs to prevent race conditions - ALL refs must be declared before any conditional returns
  const hasAutoMarkedRef = useRef(false)
  const autoMarkingInProgressRef = useRef(false)
  const lastCompletionStatusRef = useRef<string | null>(null)
  // Ref to track in-flight action handlers - moved here to be before conditional return
  const actionInProgressRef = useRef<Set<string>>(new Set())

  // Sync completion status from hooks to localStorage
  // Uses refs to prevent duplicate calls and race conditions
  React.useEffect(() => {
    // Skip if still loading
    if (isLoadingCompletion) {
      hasAutoMarkedRef.current = false // Reset when loading starts
      return
    }

    // Skip if no completion status
    if (!completionStatus) return

    // Create a stable key from completion status to detect actual changes
    const statusKey = JSON.stringify(completionStatus)

    // Skip if we've already processed this exact status
    if (lastCompletionStatusRef.current === statusKey) return

    // Skip if auto-marking is currently in progress
    if (autoMarkingInProgressRef.current) return

    // Find steps that need to be marked complete
    // Read directly from state to avoid stale closure issues
    const completedStepIds = Object.entries(completionStatus)
      .filter(([stepId, isComplete]) => {
        if (!isComplete) return false
        // Check against current state, not the callback
        return !state.completedSteps.includes(stepId)
      })
      .map(([stepId]) => stepId)

    if (completedStepIds.length > 0) {
      // Mark as in progress to prevent concurrent calls
      autoMarkingInProgressRef.current = true

      console.log('📊 Auto-marking steps as complete from hook data:', completedStepIds)
      markMultipleComplete(completedStepIds)

      // Update the last processed status key
      lastCompletionStatusRef.current = statusKey

      // Reset the in-progress flag after a short delay
      // This prevents rapid successive calls while allowing future updates
      setTimeout(() => {
        autoMarkingInProgressRef.current = false
      }, 100)
    } else {
      // Even if no steps to mark, update the status key to prevent re-processing
      lastCompletionStatusRef.current = statusKey
    }
  }, [completionStatus, isLoadingCompletion, state.completedSteps, markMultipleComplete])

  // useCallback must be called unconditionally (before any early returns)
  const handleStepAction = useCallback(async (step: OnboardingStepConfig) => {
    // Prevent duplicate action handling for the same step
    if (actionInProgressRef.current.has(step.id)) {
      console.log(`⏳ Action already in progress for "${step.id}", skipping`)
      return
    }

    // Mark as in progress
    actionInProgressRef.current.add(step.id)

    try {
      await step.onAction()

      // Skip if already completed (could have been auto-marked while action was running)
      if (state.completedSteps.includes(step.id)) {
        console.log(`✓ Step "${step.id}" already completed, skipping mark`)
        return
      }

      // Auto-mark Knowledge Base as complete (no verification needed)
      if (step.id === 'knowledge-base') {
        console.log(`🎯 Auto-completing Knowledge Base`)
        markComplete(step.id)
        return
      }

      // For other steps, re-check completion after action
      if (step.checkComplete) {
        try {
          const isComplete = await step.checkComplete()
          console.log(`🔍 Post-action check for "${step.id}": isComplete=${isComplete}`)

          // Double-check it wasn't completed while we were checking
          if (isComplete && !state.completedSteps.includes(step.id)) {
            markComplete(step.id)
          }
        } catch (error) {
          console.error(`Error checking completion for "${step.id}":`, error)
        }
      }
    } finally {
      // Remove from in-progress set
      actionInProgressRef.current.delete(step.id)
    }
  }, [state.completedSteps, markComplete])

  const handleStepSkip = (step: OnboardingStepConfig) => {
    step.onSkip?.()
    markSkipped(step.id)
  }

  const handleDismiss = () => {
    dismissOnboarding()
    onDismiss?.()
  }

  // ALL hooks have been called above - now safe to do conditional returns
  // Don't render if dismissed
  if (state.dismissed) {
    return null
  }

  const isAllComplete = allStepsComplete(steps)

  return (
    <div className={cn('w-full space-y-4', className)}>
      {/* Header - responsive: stacks on mobile */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
        <h2 className="font-['Azeret_Mono'] font-semibold text-[24px] leading-[32px] tracking-[-0.48px] text-ods-text-primary">
          Get Started
        </h2>

        {isLoadingCompletion ? (
          <div className="h-[48px] w-full md:w-[160px] bg-ods-border rounded-[6px] animate-pulse" />
        ) : isAllComplete ? (
          <Button
            variant="primary"
            onClick={handleDismiss}
            className="w-full md:w-auto"
          >
            Close Onboarding
          </Button>
        ) : (
          <Button
            variant="device-action"
            onClick={handleDismiss}
            className="w-full md:w-auto"
          >
            Skip Onboarding
          </Button>
        )}
      </div>

      {/* Step cards - no wrapper, direct rendering */}
      <div className={cn(spacing)}>
        {steps.map((step) => (
          <OnboardingStepCard
            key={step.id}
            step={step}
            isCompleted={isStepComplete(step.id)}
            isSkipped={isStepSkipped(step.id)}
            isCheckingCompletion={isLoadingCompletion}
            onAction={() => handleStepAction(step)}
            onSkip={() => handleStepSkip(step)}
          />
        ))}
      </div>
    </div>
  )
}
