'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrefersReducedMotionState } from './ui/use-prefers-reduced-motion';

export interface UseScenarioPlayerOptions {
  /** How many scenarios (tabs) the stage cycles through. */
  scenarioCount: number;
  /**
   * The last step of a scenario; steps run 0..lastStep. A function when the
   * scenarios are not all the same length: it is asked for the one being shown.
   */
  lastStep: number | ((scenario: number) => number);
  /** How long each step shows before the next one. */
  stepMs: number;
  /** How long the last step holds before the next scenario starts. */
  holdMs: number;
  /** Only advance while true (e.g. while the stage is in view). */
  enabled?: boolean;
  /** Scenario to start on. */
  initialScenario?: number;
}

export interface UseScenarioPlayerResult {
  /** Index of the scenario being shown. */
  scenario: number;
  /** Current step, 0..lastStep. */
  step: number;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** Jump to a step in the current scenario (a visitor's tap, a stepper button). */
  setStep: (step: number) => void;
  /** Switch scenario and restart it from step 0. */
  go: (scenario: number) => void;
  /** True once the system preference is known to be reduced motion. */
  reducedMotion: boolean;
}

/**
 * The clock of a looping scripted demo: N scenarios, each a fixed run of
 * steps. A step lasts `stepMs`; the last one holds `holdMs`, then the next
 * scenario starts from 0. Choosing a scenario restarts it.
 *
 * It owns no content. The caller derives what is on screen from
 * `(scenario, step)`, which is what makes a tab strip, a step list, a progress
 * line and the stage itself agree by construction.
 *
 * Under reduced motion nothing advances: the player parks on the last step of
 * the current scenario, so every scenario can still be read by choosing it.
 */
export function useScenarioPlayer({
  scenarioCount,
  lastStep: lastStepOption,
  stepMs,
  holdMs,
  enabled = true,
  initialScenario = 0,
}: UseScenarioPlayerOptions): UseScenarioPlayerResult {
  const reducedState = usePrefersReducedMotionState();
  const reducedMotion = reducedState === true;

  const [scenario, setScenario] = useState(initialScenario);
  const [rawStep, setRawStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const lastStep = typeof lastStepOption === 'function' ? lastStepOption(scenario) : lastStepOption;

  // Under reduced motion the stage shows the finished scenario.
  const step = reducedMotion ? lastStep : Math.min(rawStep, lastStep);

  const playing = enabled && !paused && reducedState === false && scenarioCount > 0;

  useEffect(() => {
    if (!playing) return undefined;
    const atEnd = rawStep >= lastStep;
    const timer = setTimeout(
      () => {
        if (atEnd) {
          setScenario(current => (current + 1) % scenarioCount);
          setRawStep(0);
        } else {
          setRawStep(current => current + 1);
        }
      },
      atEnd ? holdMs : stepMs,
    );
    return () => clearTimeout(timer);
  }, [playing, rawStep, lastStep, stepMs, holdMs, scenario, scenarioCount]);

  const setStep = useCallback(
    (next: number) => {
      setRawStep(Math.max(0, Math.min(lastStep, next)));
    },
    [lastStep],
  );

  const go = useCallback((next: number) => {
    setScenario(next);
    setRawStep(0);
  }, []);

  return { scenario, step, paused, setPaused, setStep, go, reducedMotion };
}
