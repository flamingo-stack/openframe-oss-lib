'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { usePrefersReducedMotionState } from './ui/use-prefers-reduced-motion';

/** Focus this soon after a pointer went down came from that click, not from the keyboard. */
const POINTER_FOCUS_WINDOW_MS = 800;

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
  /**
   * Start on the first scenario's LAST step instead of step 0, so a stage that
   * never gets to play (it is never scrolled into view) still reads complete.
   */
  startAtEnd?: boolean;
  /**
   * Also hold while a mouse is over the stage. Right for a carousel someone
   * reads slide by slide; wrong for a demo that IS the thing being watched (a
   * cursor resting on it would freeze it), so it is off unless asked for.
   * Keyboard focus inside the stage always holds.
   */
  holdOnHover?: boolean;
}

/** Spread on the stage's container: keyboard focus inside it (and, when asked, a mouse over it) holds the clock. */
export interface ScenarioHoldProps {
  onPointerDownCapture: (event: PointerEvent<HTMLElement>) => void;
  onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  onFocusCapture: (event: FocusEvent<HTMLElement>) => void;
  onBlurCapture: (event: FocusEvent<HTMLElement>) => void;
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
  /** Spread on the stage's container (see {@link ScenarioHoldProps}). */
  holdProps: ScenarioHoldProps;
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
 * When it moves, and when it does not (WCAG 2.2.2 and the ARIA carousel pattern):
 *   - only while `enabled` (the caller passes "in view") and the tab is visible;
 *   - never under reduced motion: it parks on the last step of the current
 *     scenario, so every scenario can still be read by choosing it;
 *   - it HOLDS while keyboard focus is inside the stage, and (with
 *     `holdOnHover`) while a mouse is over it (`holdProps`), and picks up where
 *     it was when they leave;
 *   - `setPaused` is the visitor's stop/start control;
 *   - a visitor's own choice (`go`, `setStep`) restarts the clock from there
 *     and ALWAYS plays out: it un-pauses, drops a focus hold, and runs even if
 *     `enabled` is false (they are looking at it: they just clicked it). The
 *     rotation carries on afterwards under the usual rules;
 *   - focus that a click or tap put there is not a keyboard reader: it never
 *     holds, whatever the browser reports as `:focus-visible`.
 */
export function useScenarioPlayer({
  scenarioCount,
  lastStep: lastStepOption,
  stepMs,
  holdMs,
  enabled = true,
  initialScenario = 0,
  startAtEnd = false,
  holdOnHover = false,
}: UseScenarioPlayerOptions): UseScenarioPlayerResult {
  const reducedState = usePrefersReducedMotionState();
  const reducedMotion = reducedState === true;

  const [scenario, setScenario] = useState(initialScenario);
  const [rawStep, setRawStep] = useState(startAtEnd ? Number.MAX_SAFE_INTEGER : 0);
  const [paused, setPausedState] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // The visitor chose what is playing: it plays to the end of the scenario even while `enabled` is false.
  const [forced, setForced] = useState(false);
  /** When a pointer last went down inside the stage: focus that follows it came from that click. */
  const pointerDownAt = useRef(0);
  const [tabHidden, setTabHidden] = useState(false);
  const lastStep = typeof lastStepOption === 'function' ? lastStepOption(scenario) : lastStepOption;

  // Under reduced motion the stage shows the finished scenario.
  const step = reducedMotion ? lastStep : Math.min(rawStep, lastStep);

  useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  const playing =
    (enabled || forced) && !paused && !hovered && !focused && !tabHidden && reducedState === false && scenarioCount > 0;

  useEffect(() => {
    if (!playing) return undefined;
    const atEnd = rawStep >= lastStep;
    const timer = setTimeout(
      () => {
        if (!atEnd) {
          setRawStep(current => Math.min(current, lastStep) + 1);
        } else {
          setForced(false);
          setScenario(current => (current + 1) % scenarioCount);
          setRawStep(0);
        }
      },
      atEnd ? holdMs : stepMs,
    );
    return () => clearTimeout(timer);
  }, [playing, rawStep, lastStep, stepMs, holdMs, scenario, scenarioCount]);

  const setPaused = useCallback((next: boolean) => setPausedState(next), []);

  const setStep = useCallback(
    (next: number) => {
      setRawStep(Math.max(0, Math.min(lastStep, next)));
      setPausedState(false);
      setFocused(false);
      setForced(true);
    },
    [lastStep],
  );

  const go = useCallback((next: number) => {
    setScenario(next);
    setRawStep(0);
    setPausedState(false);
    setFocused(false);
    setForced(true);
  }, []);

  const holdProps = useMemo<ScenarioHoldProps>(
    () => ({
      onPointerDownCapture: () => {
        pointerDownAt.current = Date.now();
        setFocused(false);
      },
      // A mouse only: a touch has no "leave", so it would hold forever.
      onPointerEnter: event => {
        if (holdOnHover && event.pointerType === 'mouse') setHovered(true);
      },
      onPointerLeave: event => {
        if (event.pointerType === 'mouse') setHovered(false);
      },
      // Keyboard focus only: focus that a click or tap just put there is not someone reading with the keyboard.
      onFocusCapture: event => {
        const fromPointer = Date.now() - pointerDownAt.current < POINTER_FOCUS_WINDOW_MS;
        if (!fromPointer && event.target.matches(':focus-visible')) setFocused(true);
      },
      onBlurCapture: event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      },
    }),
    [holdOnHover],
  );

  return { scenario, step, paused, setPaused, setStep, go, reducedMotion, holdProps };
}
