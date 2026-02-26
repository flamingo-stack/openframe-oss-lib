'use client'

import { useRef, useState, useCallback } from 'react'

/**
 * Custom horizontal scrollbar hook that drives a plain-DOM scrollbar.
 *
 * Returns a callback ref (`scrollRef`) to attach to the scrollable container,
 * plus refs, state, and event handlers for the track + thumb.
 *
 * Uses a **callback ref** so measurement and ResizeObserver setup happen
 * automatically when the scroll element mounts — even if it renders later
 * (e.g. after async data loads).
 */
export function useHorizontalScrollbar() {
  const scrollElRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const [thumbRatio, setThumbRatio] = useState(0)

  // Edge-fade state
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const prevCanScrollLeftRef = useRef(false)
  const prevCanScrollRightRef = useRef(false)

  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ mouseX: 0, scrollLeft: 0 })
  const rafIdRef = useRef<number>(0)

  /** Compute the thumb left% from current scrollLeft and apply to DOM directly */
  const syncThumbToDOM = useCallback(() => {
    const el = scrollElRef.current
    const thumb = thumbRef.current
    if (!el || !thumb) return

    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) {
      thumb.style.left = '0%'
      return
    }

    const ratio = el.clientWidth / el.scrollWidth
    const fraction = Math.min(Math.max(el.scrollLeft, 0), maxScroll) / maxScroll
    thumb.style.left = `${fraction * (1 - ratio) * 100}%`
  }, [])

  const syncEdgeFades = useCallback(() => {
    const el = scrollElRef.current
    if (!el) return

    const maxScroll = el.scrollWidth - el.clientWidth
    const ratio = el.clientWidth / el.scrollWidth
    if (ratio >= 1 || maxScroll <= 0) {
      if (prevCanScrollLeftRef.current) {
        prevCanScrollLeftRef.current = false
        setCanScrollLeft(false)
      }
      if (prevCanScrollRightRef.current) {
        prevCanScrollRightRef.current = false
        setCanScrollRight(false)
      }
      return
    }

    const fraction = Math.min(Math.max(el.scrollLeft, 0), maxScroll) / maxScroll
    const left = fraction > 0.001
    const right = fraction < 0.999

    if (left !== prevCanScrollLeftRef.current) {
      prevCanScrollLeftRef.current = left
      setCanScrollLeft(left)
    }
    if (right !== prevCanScrollRightRef.current) {
      prevCanScrollRightRef.current = right
      setCanScrollRight(right)
    }
  }, [])

  const measure = useCallback(() => {
    const el = scrollElRef.current
    if (!el) return
    const ratio = el.clientWidth / el.scrollWidth
    setThumbRatio(ratio >= 1 ? 0 : ratio)
    syncThumbToDOM()
    syncEdgeFades()
  }, [syncThumbToDOM, syncEdgeFades])

  // Callback ref
  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    // Teardown previous
    if (roRef.current) {
      roRef.current.disconnect()
      roRef.current = null
    }
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = 0
    }

    scrollElRef.current = node

    if (node) {
      const ratio = node.clientWidth / node.scrollWidth
      setThumbRatio(ratio >= 1 ? 0 : ratio)

      roRef.current = new ResizeObserver(measure)
      roRef.current.observe(node)

      requestAnimationFrame(() => {
        syncThumbToDOM()
        syncEdgeFades()
      })
    } else {
      setThumbRatio(0)
      prevCanScrollLeftRef.current = false
      prevCanScrollRightRef.current = false
      setCanScrollLeft(false)
      setCanScrollRight(false)
    }
  }, [measure, syncThumbToDOM, syncEdgeFades])

  // RAF-throttled scroll handler
  const onScroll = useCallback(() => {
    if (isDraggingRef.current) return

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = requestAnimationFrame(() => {
      syncThumbToDOM()
      syncEdgeFades()
    })
  }, [syncThumbToDOM, syncEdgeFades])

  // Track click — read ratio from DOM, smooth scroll
  const onTrackClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-scrollbar-thumb]')) return

    const track = trackRef.current
    const el = scrollElRef.current
    if (!track || !el) return

    const ratio = el.clientWidth / el.scrollWidth
    if (ratio >= 1) return

    const rect = track.getBoundingClientRect()
    const thumbWidth = rect.width * ratio
    const maxThumbOffset = rect.width - thumbWidth
    if (maxThumbOffset <= 0) return

    const targetFraction = Math.max(0, Math.min(1,
      (e.clientX - rect.left - thumbWidth / 2) / maxThumbOffset
    ))
    const targetScrollLeft = targetFraction * (el.scrollWidth - el.clientWidth)
    el.scrollTo({ left: targetScrollLeft, behavior: 'smooth' })
  }, [])

  // Wheel on track → forward to scroll container
  const onTrackWheel = useCallback((e: React.WheelEvent) => {
    const el = scrollElRef.current
    if (!el) return
    e.preventDefault()
    el.scrollLeft += e.deltaX || e.deltaY
  }, [])

  // Drag: pointer down
  const onThumbPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = scrollElRef.current
    if (!el) return
    isDraggingRef.current = true
    dragStartRef.current = { mouseX: e.clientX, scrollLeft: el.scrollLeft }
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    target.style.cursor = 'grabbing'
  }, [])

  // Drag: pointer move
  const onThumbPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const el = scrollElRef.current
    const track = trackRef.current
    if (!el || !track) return

    const currentThumbRatio = el.clientWidth / el.scrollWidth
    if (currentThumbRatio >= 1) return

    const trackWidth = track.clientWidth
    const thumbWidth = trackWidth * currentThumbRatio
    const maxThumbTravel = trackWidth - thumbWidth
    if (maxThumbTravel <= 0) return

    const mouseDelta = e.clientX - dragStartRef.current.mouseX
    const scrollRange = el.scrollWidth - el.clientWidth
    el.scrollLeft = Math.min(
      Math.max(dragStartRef.current.scrollLeft + (mouseDelta / maxThumbTravel) * scrollRange, 0),
      scrollRange
    )

    syncThumbToDOM()
    syncEdgeFades()
  }, [syncThumbToDOM, syncEdgeFades])

  // Drag: pointer up
  const onThumbPointerUp = useCallback((e: React.PointerEvent) => {
    isDraggingRef.current = false
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
    target.style.cursor = 'grab'
  }, [])

  return {
    scrollRef,
    trackRef,
    thumbRef,
    thumbRatio,
    canScrollLeft,
    canScrollRight,
    onScroll,
    onTrackClick,
    onTrackWheel,
    onThumbPointerDown,
    onThumbPointerMove,
    onThumbPointerUp,
  }
}
