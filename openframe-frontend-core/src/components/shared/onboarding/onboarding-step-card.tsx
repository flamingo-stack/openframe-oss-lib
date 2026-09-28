'use client';

import React from 'react';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/button';
import { InteractiveCard } from '../../ui/interactive-card';
import { StatusBadge } from '../../ui/status-badge';

export interface OnboardingStepCardProps {
  step: {
    id: string;
    title: string;
    description: string;
    actionIcon: (color?: string) => React.ReactNode;
    actionText: string;
    completedText: string;
    onAction: () => void | Promise<void>;
    onSkip?: () => void;
  };
  isCompleted: boolean;
  isSkipped: boolean;
  isCheckingCompletion: boolean;
  onAction: () => void | Promise<void>;
  onSkip: () => void;
  className?: string;
}

export function OnboardingStepCard({
  step,
  isCompleted,
  isSkipped,
  isCheckingCompletion,
  onAction,
  onSkip,
  className,
}: OnboardingStepCardProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsProcessing(true);
    try {
      await onAction();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSkip();
  };

  return (
    <InteractiveCard
      clickable={false}
      className={cn(
        'rounded-[6px] border border-ods-border bg-ods-card',
        'flex flex-col md:flex-row',
        'min-h-[80px] md:h-[80px]',
        'items-start md:items-center',
        'gap-3 md:gap-4',
        'px-4 py-4 md:py-0',
        className,
      )}
    >
      {/* Left column - content */}
      <div className="flex w-full min-w-0 flex-1 flex-col justify-center gap-1 md:w-auto">
        <h3 className="truncate text-ods-text-primary text-h4" title={step.title}>
          {step.title}
        </h3>
        <p className="h-[20px] truncate text-ods-text-secondary text-h6" title={step.description}>
          {step.description}
        </p>
      </div>

      {/* Right column - action buttons, completed badge, or skipped badge */}
      <div
        className="flex w-full shrink-0 items-center justify-start gap-2 md:w-auto md:justify-end"
        onClick={e => e.stopPropagation()}
      >
        {isCheckingCompletion ? (
          <>
            <div className="h-[32px] w-[100px] animate-pulse rounded-[6px] bg-ods-border" />
            <div className="h-[32px] w-[120px] animate-pulse rounded-[6px] bg-ods-border" />
          </>
        ) : isCompleted ? (
          <>
            <StatusBadge text="COMPLETED" variant="card" colorScheme="success" />
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
            <StatusBadge text="SKIPPED" variant="card" colorScheme="default" />
          </>
        ) : (
          <>
            <Button variant="outline" onClick={handleSkip}>
              Skip Step
            </Button>
            <Button variant="accent" onClick={handleAction} disabled={isProcessing} leftIcon={step.actionIcon('black')}>
              {step.actionText}
            </Button>
          </>
        )}
      </div>
    </InteractiveCard>
  );
}
