'use client'

import React from 'react'
import { InteractiveCard } from '../../ui/interactive-card'
import { Button } from '../../ui/button'
import { StatusBadge } from '../../ui/status-badge'
import { cn } from '../../../utils/cn'

export interface OnboardingStepCardProps {
  step: {
    id: string
    title: string
    description: string
    actionIcon: (color?: string) => React.ReactNode
    actionText: string
    completedText: string
    onAction: () => void | Promise<void>
    onSkip?: () => void
  }
  isCompleted: boolean
  isSkipped: boolean
  isCheckingCompletion: boolean
  onAction: () => void | Promise<void>
  onSkip: () => void
  className?: string
}

export function OnboardingStepCard({
  step,
  isCompleted,
  isSkipped,
  isCheckingCompletion,
  onAction,
  onSkip,
  className
}: OnboardingStepCardProps) {
  const [isProcessing, setIsProcessing] = React.useState(false)

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsProcessing(true)
    try {
      await onAction()
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSkip()
  }

  return (
    <InteractiveCard
      clickable={true}
      className={cn(
        'bg-ods-card border border-ods-border rounded-[6px]',
        'flex flex-col md:flex-row',
        'min-h-[80px] md:h-[80px]',
        'items-start md:items-center',
        'gap-3 md:gap-4',
        'px-4 py-4 md:py-0',
        className
      )}
    >
      {/* Left column - content */}
      <div className="flex-1 w-full md:w-auto min-w-0 flex flex-col justify-center gap-1">
        <h3 className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-primary truncate">
          {step.title}
        </h3>
        <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate h-[20px]">
          {step.description}
        </p>
      </div>

      {/* Right column - action buttons, completed badge, or skipped badge */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
        {isCheckingCompletion ? (
          <>
            <div className="h-[32px] w-[100px] bg-ods-border rounded-[6px] animate-pulse" />
            <div className="h-[32px] w-[120px] bg-ods-border rounded-[6px] animate-pulse" />
          </>
        ) : isCompleted ? (
          <>
            <StatusBadge
              text="COMPLETED"
              variant="card"
              colorScheme="success"
            />
            <Button
              variant="outline"
              onClick={handleAction}
              disabled={isProcessing}
              leftIcon={step.actionIcon('white')}
            >
              {step.completedText}
            </Button>
          </>
        ) : isSkipped ? (
          <>
            <StatusBadge
              text="SKIPPED"
              variant="card"
              colorScheme="default"
            />
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleSkip}
            >
              Skip Step
            </Button>
            <Button
              variant="primary"
              onClick={handleAction}
              disabled={isProcessing}
              leftIcon={step.actionIcon('black')}
            >
              {step.actionText}
            </Button>
          </>
        )}
      </div>
    </InteractiveCard>
  )
}
