'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { type AutoplayHoldProps, useAutoplay } from './ui/use-autoplay';

/**
 * How soon the first step follows the moment the demo becomes playable (it
 * scrolled into view, the tab came back, the visitor let go of it). A demo that sits
 * still for a whole step after it appears reads as broken; one that moves
 * within a third of a second reads as responding to you.
 */
const START_MS = 300;

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
  /**
   * Whether step 0 of every scenario is an EMPTY stage, to be left at once
   * (default true: a stage that sits empty for a whole step after a tap reads
   * as not responding). False when step 0 already shows something to read: it
   * then lasts a whole `stepMs` like every other step.
   */
  emptyFirstStep?: boolean;
}

export interface UseScenarioPlayerResult {
  /** Index of the scenario being shown. */
  scenario: number;
  /** Current step, 0..lastStep. */
  step: number;
  /** The visitor is holding it still (pressing on it, or the keyboard is inside it). */
  held: boolean;
  /** Spread on the stage's outer element: how a visitor stops it (`useAutoplay`). */
  holdProps: AutoplayHoldProps;
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
 * WHEN IT MOVES is `useAutoplay`'s rule: on screen (`enabled`), tab visible,
 * not held by the visitor, motion allowed. Under reduced motion it parks on the last step
 * of the current scenario, and every scenario can still be read by choosing it.
 *
 * The moment it becomes playable, and at the top of every scenario (the
 * rotation moved on, or a tab was chosen), its first step follows within
 * `START_MS`, not a whole step later; from there every step takes `stepMs`.
 *
 * A visitor's own choice (`go`, `setStep`) moves the clock there and lets go of
 * any hold; the rotation carries on from that point.
 */
export function useScenarioPlayer({
  scenarioCount,
  lastStep: lastStepOption,
  stepMs,
  holdMs,
  enabled = true,
  initialScenario = 0,
  startAtEnd = false,
  emptyFirstStep = true,
}: UseScenarioPlayerOptions): UseScenarioPlayerResult {
  const auto = useAutoplay(enabled);
  const { reducedMotion, held, holdProps, release } = auto;

  const [scenario, setScenario] = useState(initialScenario);
  const [rawStep, setRawStep] = useState(startAtEnd ? Number.MAX_SAFE_INTEGER : 0);
  const lastStep = typeof lastStepOption === 'function' ? lastStepOption(scenario) : lastStepOption;

  // Under reduced motion the stage shows the finished scenario.
  const step = reducedMotion ? lastStep : Math.min(rawStep, lastStep);

  const playing = auto.playing && scenarioCount > 0;

  // True from the moment it becomes playable until its first tick has been scheduled.
  const starting = useRef(false);
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (playing && !wasPlaying.current) starting.current = true;
    wasPlaying.current = playing;
    if (!playing) return undefined;
    const atEnd = rawStep >= lastStep;
    // The first step comes quickly, both after it becomes playable and at the
    // top of every scenario whose step 0 is the empty stage (the rotation
    // moved on, or the visitor chose a tab): a stage that sits empty for a
    // whole step after a tap reads as not responding. A finished scenario still
    // holds its full time: it is there to be read.
    const quickStart = (starting.current || (emptyFirstStep && rawStep === 0)) && !atEnd;
    starting.current = false;
    const timer = setTimeout(
      () => {
        if (atEnd) {
          setScenario(current => (current + 1) % scenarioCount);
          setRawStep(0);
        } else {
          setRawStep(current => Math.min(current, lastStep) + 1);
        }
      },
      atEnd ? holdMs : quickStart ? Math.min(START_MS, stepMs) : stepMs,
    );
    return () => clearTimeout(timer);
  }, [playing, rawStep, lastStep, stepMs, holdMs, scenario, scenarioCount, emptyFirstStep]);

  // A visitor's choice is an instruction to play from there: it lets go of any hold.
  const setStep = useCallback(
    (next: number) => {
      setRawStep(Math.max(0, Math.min(lastStep, next)));
      release();
    },
    [lastStep, release],
  );

  const go = useCallback(
    (next: number) => {
      setScenario(next);
      setRawStep(0);
      release();
    },
    [release],
  );

  return { scenario, step, held, holdProps, setStep, go, reducedMotion };
}
