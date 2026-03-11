'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadOnboardingState,
  type OnboardingState,
  saveOnboardingState,
  dismissOnboarding as storageDismiss,
  isStepComplete as storageIsComplete,
  isStepSkipped as storageIsSkipped,
  markStepComplete as storageMarkComplete,
  markMultipleComplete as storageMarkMultiple,
  markStepSkipped as storageMarkSkipped,
} from '../../utils/onboarding-storage';

export interface OnboardingStepConfig {
  id: string;
  title: string;
  description: string;
  actionIcon: (color?: string) => React.ReactNode;
  actionText: string;
  completedText: string;
  onAction: () => void | Promise<void>;
  onSkip?: () => void;
  checkComplete?: () => boolean | Promise<boolean>;
}

export type { OnboardingState };

/**
 * Hook for managing onboarding state with localStorage persistence
 * Uses simple storage utilities for atomic updates and reliable re-renders
 */
export function useOnboardingState(storageKey: string = 'openframe-onboarding-state') {
  const [state, setState] = useState<OnboardingState>(() => loadOnboardingState(storageKey));
  const [, forceUpdate] = useState(0);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageUpdate = (e: CustomEvent) => {
      if (e.detail.key === storageKey) {
        const newState = loadOnboardingState(storageKey);
        setState(newState);
        forceUpdate(prev => prev + 1);
        console.log('🔄 State updated from storage event:', newState);
      }
    };

    window.addEventListener('localStorageUpdate', handleStorageUpdate as EventListener);
    return () => {
      window.removeEventListener('localStorageUpdate', handleStorageUpdate as EventListener);
    };
  }, [storageKey]);

  const markComplete = useCallback(
    (stepId: string) => {
      console.log(`🎯 markComplete called for: "${stepId}"`);
      const newState = storageMarkComplete(storageKey, stepId);
      setState(newState);
      forceUpdate(prev => prev + 1);
    },
    [storageKey],
  );

  const markSkipped = useCallback(
    (stepId: string) => {
      console.log(`⏭️ markSkipped called for: "${stepId}"`);
      const newState = storageMarkSkipped(storageKey, stepId);
      setState(newState);
      forceUpdate(prev => prev + 1);
    },
    [storageKey],
  );

  const dismissOnboarding = useCallback(() => {
    console.log(`🚫 dismissOnboarding called`);
    const newState = storageDismiss(storageKey);
    setState(newState);
    forceUpdate(prev => prev + 1);
  }, [storageKey]);

  const markMultipleComplete = useCallback(
    (stepIds: string[]) => {
      console.log(`🎯 markMultipleComplete called for:`, stepIds);
      const newState = storageMarkMultiple(storageKey, stepIds);
      setState(newState);
      forceUpdate(prev => prev + 1);
      console.log(`📝 State after batch:`, newState);
    },
    [storageKey],
  );

  const isStepComplete = useCallback(
    (stepId: string): boolean => {
      return state.completedSteps.includes(stepId);
    },
    [state.completedSteps],
  );

  const isStepSkipped = useCallback(
    (stepId: string): boolean => {
      return state.skippedSteps.includes(stepId);
    },
    [state.skippedSteps],
  );

  const allStepsComplete = useCallback(
    (steps: OnboardingStepConfig[]): boolean => {
      return steps.every(step => isStepComplete(step.id) || isStepSkipped(step.id));
    },
    [isStepComplete, isStepSkipped],
  );

  return {
    state,
    markComplete,
    markSkipped,
    dismissOnboarding,
    isStepComplete,
    isStepSkipped,
    allStepsComplete,
    markMultipleComplete,
  };
}
