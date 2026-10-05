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
  /** Only advance while true: the caller passes "on screen" (`useInView`). */
  enabled?: boolean;
  /** Scenario to start on. */
  initialScenario?: number;
  /**
   * Start on the first scenario's LAST step instead of step 0, so a stage that
   * never gets to play (it is never scrolled into view) still reads complete.
   */
  startAtEnd?: boolean;
}

export interface UseScenarioPlayerResult {
  /** Index of the scenario being shown. */
  scenario: number;
  /** Current step, 0..lastStep. */
  step: number;
  /** The visitor stopped it with the pause control. */
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
 * WHEN IT MOVES is four plain facts, and nothing else:
 *   1. it is on screen (`enabled`, the caller's `useInView`);
 *   2. the browser tab is visible (`visibilitychange`, and `pageshow` for a
 *      page restored from the back/forward cache);
 *   3. the visitor has not pressed pause (`setPaused`, the stop/start control
 *      WCAG 2.2.2 asks of anything that moves for more than five seconds);
 *   4. motion is allowed: under reduced motion it parks on the last step of
 *      the current scenario, and every scenario can still be read by choosing it.
 *
 * Every one of those has a way back that does not depend on the visitor doing
 * something particular: scroll back and it runs, return to the tab and it
 * runs, press play and it runs. It deliberately does NOT hold on hover or on
 * keyboard focus. Both were tried: a browser re-reports focus on the last
 * clicked control when its window is re-activated, and whether that counts as
 * "keyboard focus" varies by browser and setting, so the demo froze with no
 * visible reason and no visible way out. The pause control is the one, always
 * visible, always reversible way to stop it.
 *
 * A visitor's own choice (`go`, `setStep`) moves the clock there and un-pauses
 * it; the rotation carries on from that point.
 */
export function useScenarioPlayer({
  scenarioCount,
  lastStep: lastStepOption,
  stepMs,
  holdMs,
  enabled = true,
  initialScenario = 0,
  startAtEnd = false,
}: UseScenarioPlayerOptions): UseScenarioPlayerResult {
  const reducedState = usePrefersReducedMotionState();
  const reducedMotion = reducedState === true;

  const [scenario, setScenario] = useState(initialScenario);
  const [rawStep, setRawStep] = useState(startAtEnd ? Number.MAX_SAFE_INTEGER : 0);
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const lastStep = typeof lastStepOption === 'function' ? lastStepOption(scenario) : lastStepOption;

  // Under reduced motion the stage shows the finished scenario.
  const step = reducedMotion ? lastStep : Math.min(rawStep, lastStep);

  useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);

  const playing = enabled && !paused && !tabHidden && reducedState === false && scenarioCount > 0;

  useEffect(() => {
    if (!playing) return undefined;
    const atEnd = rawStep >= lastStep;
    const timer = setTimeout(
      () => {
        if (atEnd) {
          setScenario(current => (current + 1) % scenarioCount);
          setRawStep(0);
        } else {
          setRawStep(current => Math.min(current, lastStep) + 1);
        }
      },
      atEnd ? holdMs : stepMs,
    );
    return () => clearTimeout(timer);
  }, [playing, rawStep, lastStep, stepMs, holdMs, scenario, scenarioCount]);

  const setStep = useCallback(
    (next: number) => {
      setRawStep(Math.max(0, Math.min(lastStep, next)));
      setPaused(false);
    },
    [lastStep],
  );

  const go = useCallback((next: number) => {
    setScenario(next);
    setRawStep(0);
    setPaused(false);
  }, []);

  return { scenario, step, paused, setPaused, setStep, go, reducedMotion };
}
