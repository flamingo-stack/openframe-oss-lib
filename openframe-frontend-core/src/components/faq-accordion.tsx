"use client"

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from "../utils/cn"
import { faqItemAnchor } from "../utils/faq-anchor"

export interface FaqItem {
  id: number | string
  question: string
  answer: string
}

interface FaqAccordionProps {
  items: FaqItem[]
  defaultOpenIds?: (number | string)[]
}

// Utility to measure scrollHeight outside render cycle
const useMeasuredHeight = (isOpen: boolean) => {
  const ref = useRef<HTMLDivElement | null>(null)
  const [maxHeight, setMaxHeight] = useState<string>('0px')

  const measure = useCallback(() => {
    if (ref.current) {
      const height = ref.current.scrollHeight
      setMaxHeight(`${height}px`)
    }
  }, [])

  // Update height only when section is open
  useEffect(() => {
    if (isOpen) {
      measure()
    } else {
      setMaxHeight('0px')
    }
  }, [isOpen, measure])

  return { ref, maxHeight }
}

export function FaqAccordion({ items, defaultOpenIds = [] }: FaqAccordionProps) {
  const [openSet, setOpenSet] = useState<Set<string | number>>(new Set(defaultOpenIds))

  const toggle = (id: string | number) => {
    setOpenSet(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-md border border-ods-border divide-y divide-ods-border bg-ods-bg overflow-hidden">
      {items.map(item => {
        const isOpen = openSet.has(item.id)
        const { ref, maxHeight } = useMeasuredHeight(isOpen)

        return (
          <div
            key={item.id}
            // Per-row anchor — chat citation chips (`/faqs#faq-item-<id>`) land
            // here via native browser hash scroll AND via `FaqSection`'s tween
            // dispatch. `scroll-mt-24` keeps the row header below the 96px
            // sticky nav offset (matches `<section>`'s scroll-margin for
            // category anchors).
            id={faqItemAnchor(item.id)}
            className="scroll-mt-24 transition-colors hover:bg-ods-bg-hover"
          >
            {/* Header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggle(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(item.id);
                }
              }}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-6 md:gap-10 px-6 py-4 text-left focus:outline-none transition-colors cursor-pointer"
            >
              <h3 className="flex-1 min-w-0 break-words">
                {item.question}
              </h3>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'size-6 shrink-0 text-ods-text-primary transition-transform duration-300',
                  isOpen && 'rotate-180',
                )}
              />
            </div>
            {/* Content wrapper with max-height animation */}
            <div
              style={{ maxHeight, transition: 'max-height 0.35s ease-in-out, opacity 0.35s ease-in-out', opacity: isOpen ? 1 : 0 }}
              className="overflow-hidden"
            >
              {/* break-words: FAQ answers render as plain text, so a long URL or
                  token has no wrap opportunity — and the parent is overflow-hidden,
                  which would CLIP it past the viewport on mobile. Mirrors the
                  markdown-renderer overflow-wrap fix. */}
              <div ref={ref} className="px-6 pb-4 text-ods-text-primary text-h4 break-words">
                {item.answer}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 