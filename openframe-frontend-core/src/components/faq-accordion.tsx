'use client';

import { useState } from 'react';
import { cn } from '../utils/cn';
import { faqItemAnchor } from '../utils/faq-anchor';
import { Chevron02DownIcon } from './icons-v2-generated/arrows/chevron-02-down-icon';

export interface FaqItem {
  id: number | string;
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  defaultOpenIds?: (number | string)[];
}

export function FaqAccordion({ items, defaultOpenIds = [] }: FaqAccordionProps) {
  const [openSet, setOpenSet] = useState<Set<string | number>>(new Set(defaultOpenIds));

  const toggle = (id: string | number) => {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y divide-ods-border overflow-hidden rounded-md border border-ods-border bg-transparent">
      {items.map(item => {
        const isOpen = openSet.has(item.id);

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
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(item.id);
                }
              }}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center gap-6 px-6 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus md:gap-10"
            >
              <h3 className="min-w-0 flex-1 break-words">{item.question}</h3>
              <Chevron02DownIcon
                aria-hidden="true"
                size={24}
                className={cn(
                  'shrink-0 text-ods-text-primary transition-transform duration-300',
                  isOpen && 'rotate-180',
                )}
              />
            </div>
            {/* Content wrapper. Collapses with the grid 1fr->0fr transition the
                rest of the design system uses (see AnnouncementBar) rather than
                an animated max-height: measuring `scrollHeight` needed a hook
                PER ROW, which meant calling hooks inside `items.map` — the hook
                order then changed whenever `items` did. Grid needs no
                measurement, and it animates correctly when an answer's height
                changes after mount. */}
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0 }}
            >
              {/* break-words: FAQ answers render as plain text, so a long URL or
                  token has no wrap opportunity — and the row is overflow-hidden,
                  which would CLIP it past the viewport on mobile. Mirrors the
                  markdown-renderer overflow-wrap fix. */}
              <div className="overflow-hidden">
                <div className="break-words px-6 pb-4 text-ods-text-primary text-h4">{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
