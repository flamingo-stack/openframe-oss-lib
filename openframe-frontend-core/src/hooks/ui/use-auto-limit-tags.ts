"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface UseAutoLimitTagsOptions {
  /** Total number of tags */
  count: number
  /** Fixed limit or "auto" for DOM-based measurement. Default "auto" */
  limitTags?: number | "auto"
  /** Placeholder text used to reserve input width (only used in "auto" mode) */
  placeholder?: string
}

export interface UseAutoLimitTagsReturn {
  /** How many tags to show */
  visibleCount: number
  /** Ref for the zone that contains tags + input (must have overflow-hidden, gap, padding) */
  middleRef: React.RefObject<HTMLDivElement | null>
  /** Ref for the off-screen container that holds measurement copies of ALL tags */
  measureRef: React.RefObject<HTMLDivElement | null>
  /** Ref for the hidden span that measures placeholder text width */
  textMeasureRef: React.RefObject<HTMLSpanElement | null>
  /** Ref for the "+N" badge element (used to measure its width) */
  badgeRef: React.RefObject<HTMLButtonElement | null>
  /** Ref for the input element (used to read its min-width) */
  inputRef: React.RefObject<HTMLInputElement | null>
}

/**
 * Calculates how many tags fit in a single-line container.
 *
 * Requires three off-screen measurement elements rendered by the consumer:
 * 1. A `<div ref={measureRef}>` containing Tag copies for every item (to measure widths)
 * 2. A `<span ref={textMeasureRef}>` containing the placeholder text (to reserve input width)
 * 3. The `<button ref={badgeRef}>` for the "+N" badge (to measure badge width)
 *
 * The hook reads real CSS values (padding, gap) from the middleRef container,
 * so it works regardless of responsive breakpoints or custom styling.
 */
export function useAutoLimitTags({
  count,
  limitTags = "auto",
  placeholder = "",
}: UseAutoLimitTagsOptions): UseAutoLimitTagsReturn {
  const middleRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const textMeasureRef = useRef<HTMLSpanElement>(null)
  const badgeRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [visibleCount, setVisibleCount] = useState(count)

  const recalculate = useCallback(() => {
    // Fixed limit — skip DOM measurement
    if (limitTags !== "auto") {
      setVisibleCount(Math.min(limitTags, count))
      return
    }

    const middle = middleRef.current
    const measure = measureRef.current
    if (!middle || !measure) {
      setVisibleCount(count)
      return
    }
    if (count === 0) {
      setVisibleCount(0)
      return
    }

    // Read real CSS metrics from the middle zone
    const cs = getComputedStyle(middle)
    const padL = parseFloat(cs.paddingLeft) || 0
    const padR = parseFloat(cs.paddingRight) || 0
    const gap = parseFloat(cs.gap) || 0
    const middleW = middle.clientWidth

    // Reserve space for the input based on placeholder width
    const textW = textMeasureRef.current?.offsetWidth ?? 60
    const inputMinW = inputRef.current
      ? parseFloat(getComputedStyle(inputRef.current).minWidth) || 60
      : 60
    const inputReservedW = Math.max(textW + 8, inputMinW)

    // Available = middle zone − padding − input reserved − gap before input
    const available = middleW - padL - padR - inputReservedW - gap

    // Measure every tag from the off-screen container
    const tagEls = Array.from(measure.children) as HTMLElement[]
    const widths = tagEls.map((el) => el.offsetWidth)

    // Fast check: do ALL tags fit?
    let total = 0
    for (let i = 0; i < widths.length; i++) {
      total += widths[i] + (i > 0 ? gap : 0)
    }
    if (total <= available) {
      setVisibleCount(count)
      return
    }

    // Not all fit → reserve space for the "+N" badge
    const badgeW = badgeRef.current?.offsetWidth ?? 40
    const spaceWithBadge = available - badgeW - gap

    let used = 0
    let fitCount = 0
    for (let i = 0; i < widths.length; i++) {
      const need = widths[i] + (i > 0 ? gap : 0)
      if (used + need > spaceWithBadge) break
      used += need
      fitCount++
    }

    setVisibleCount(Math.max(0, fitCount))
  }, [count, limitTags, placeholder])

  // Recalculate when inputs change
  useEffect(() => {
    recalculate()
  }, [recalculate])

  // Recalculate on container resize
  useEffect(() => {
    const el = middleRef.current
    if (!el) return
    const ro = new ResizeObserver(recalculate)
    ro.observe(el)
    return () => ro.disconnect()
  }, [recalculate])

  return { visibleCount, middleRef, measureRef, textMeasureRef, badgeRef, inputRef }
}
