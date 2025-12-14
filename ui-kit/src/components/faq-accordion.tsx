"use client"

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronButton } from './ui/chevron-button'
import { cn } from "../utils/cn"

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
    <div className="rounded-3xl border border-ods-border divide-y divide-[#3A3A3A] bg-ods-card overflow-hidden">
      {items.map(item => {
        const isOpen = openSet.has(item.id)
        const { ref, maxHeight } = useMeasuredHeight(isOpen)

        return (
          <div
            key={item.id}
            className={cn('group transition-colors hover:bg-[#1E1E1E]', isOpen ? 'bg-[#161616]' : 'bg-transparent')}
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
              className="flex w-full items-center justify-between px-6 md:px-8 py-6 text-left focus:outline-none transition-colors cursor-pointer"
            >
              <h3>
                {item.question}
              </h3>
              <div className="flex-shrink-0">
                <ChevronButton
                  size="md"
                  isExpanded={isOpen}
                  backgroundColor="transparent"
                  borderColor="#3A3A3A"
                />
              </div>
            </div>
            {/* Content wrapper with max-height animation */}
            <div
              style={{ maxHeight, transition: 'max-height 0.35s ease-in-out, opacity 0.35s ease-in-out', opacity: isOpen ? 1 : 0 }}
              className="overflow-hidden group-hover:bg-[#1E1E1E]/30"
            >
              <div ref={ref} className="px-6 md:px-8 pb-6 text-ods-text-primary font-['DM_Sans'] font-medium text-[18px] leading-6">
                {item.answer}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 