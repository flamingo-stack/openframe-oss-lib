'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface UseQuickActionHintOptions {
  /** Number of quick actions to cycle through */
  actionCount: number
  /** Duration each action is highlighted in milliseconds */
  cycleDuration?: number
  /** Whether the hint should be enabled */
  enabled?: boolean
}

interface UseQuickActionHintReturn {
  /** The index of the currently active hint (-1 if none) */
  activeHintIndex: number
  /** Manually stop the hint animation */
  stopHint: () => void
  /** Reference to attach to the container element (not used in simplified version) */
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * SIMPLIFIED hook for managing quick action hint animations
 *
 * Cycles infinitely through quick actions until user interacts.
 * Simple mount-based trigger - no complex visibility detection.
 */
export function useQuickActionHint({
  actionCount,
  cycleDuration = 5000,
  enabled = true
}: UseQuickActionHintOptions): UseQuickActionHintReturn {
  const [activeHintIndex, setActiveHintIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cycleCountRef = useRef(0)
  const currentIndexRef = useRef(0)
  const sequenceRef = useRef<number[]>([])

  /**
   * Fisher-Yates shuffle for random, non-repeating sequence
   */
  const shuffleIndices = useCallback((length: number): number[] => {
    const indices = Array.from({ length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return indices
  }, [])

  /**
   * Stop the hint animation
   */
  const stopHint = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setActiveHintIndex(-1)
    cycleCountRef.current = 0
    currentIndexRef.current = 0
    sequenceRef.current = []
  }, [])

  /**
   * Advance to next hint
   */
  const advanceHint = useCallback(() => {
    // Generate new sequence if starting a new cycle
    if (currentIndexRef.current === 0) {
      sequenceRef.current = shuffleIndices(actionCount)
    }

    // Get next index
    const nextIndex = sequenceRef.current[currentIndexRef.current]
    setActiveHintIndex(nextIndex)

    // Move to next position
    currentIndexRef.current++

    // Check if cycle complete - reset to continue infinitely
    if (currentIndexRef.current >= actionCount) {
      currentIndexRef.current = 0
      cycleCountRef.current++
    }

    // Schedule next hint - runs infinitely until stopped by user interaction
    timeoutRef.current = setTimeout(advanceHint, cycleDuration)
  }, [actionCount, cycleDuration, shuffleIndices])

  /**
   * Start hint animation when component mounts with actions
   */
  useEffect(() => {
    // Don't start if disabled, no actions, or reduced motion
    if (!enabled || actionCount === 0) {
      return
    }

    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) return
    }

    // Start after a short delay to allow component to settle
    const startTimeout = setTimeout(() => {
      cycleCountRef.current = 0
      currentIndexRef.current = 0
      advanceHint()
    }, 500)

    // Cleanup on unmount or when dependencies change
    return () => {
      clearTimeout(startTimeout)
      stopHint()
    }
  }, [enabled, actionCount, advanceHint, stopHint])

  return {
    activeHintIndex,
    stopHint,
    containerRef
  }
}
