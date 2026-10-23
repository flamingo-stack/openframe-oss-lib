/**
 * The reset that brings a dismissed walkthrough back, round-tripped through
 * real localStorage: reading the state back is the only proof the write stuck.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissOnboarding,
  loadOnboardingState,
  markStepComplete,
  markStepSkipped,
  resetOnboardingState,
} from '../onboarding-storage';

const KEY = 'onboarding-storage-test';

afterEach(() => localStorage.clear());

describe('resetOnboardingState', () => {
  it('clears completed and skipped steps and undoes a dismissal', () => {
    markStepComplete(KEY, 'install');
    markStepSkipped(KEY, 'video');
    dismissOnboarding(KEY);
    expect(loadOnboardingState(KEY).dismissed).toBe(true);

    const reset = resetOnboardingState(KEY);

    expect(reset).toMatchObject({ completedSteps: [], skippedSteps: [], dismissed: false });
    expect(loadOnboardingState(KEY)).toMatchObject({ completedSteps: [], skippedSteps: [], dismissed: false });
  });

  it('tells other hook instances through the localStorageUpdate event', () => {
    const seen: string[] = [];
    const listener = (event: Event) => seen.push((event as CustomEvent<{ key: string }>).detail.key);
    window.addEventListener('localStorageUpdate', listener);
    try {
      resetOnboardingState(KEY);
    } finally {
      window.removeEventListener('localStorageUpdate', listener);
    }
    expect(seen).toEqual([KEY]);
  });
});
