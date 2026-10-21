'use client';

import { useState } from 'react';
import { cn } from '../utils/cn';
import { faqItemAnchor } from '../utils/faq-anchor';
import { Chevron02DownIcon } from './icons-v2-generated/arrows/chevron-02-down-icon';
import { TextLineSkeleton } from './loading/unified-skeleton';
import { LoadingItems, useLoadingScope } from './ui/loading-scope';

export interface FaqItem {
  id: number | string;
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
  defaultOpenIds?: (number | string)[];
  /** The questions are still being read: the accordion draws its skeleton. A loading scope does the same. */
  loading?: boolean;
  /** Rows the skeleton draws: the questions the host reads. Default the items' count, else
   *  `FAQ_ACCORDION_SKELETON_ROWS`. */
  skeletonCount?: number;
}

/** The accordion's layout, read by the accordion and by its skeleton, so the skeleton is the accordion's size. */
const ACCORDION_FRAME_CLASS =
  'divide-y divide-ods-border overflow-hidden rounded-md border border-ods-border bg-transparent';
/** A question's row (its anchor offset under the sticky nav), read by the accordion's rows and by its loading rows. */
const ROW_FRAME_CLASS = 'scroll-mt-24 transition-colors';
const ROW_HEADER_CLASS = 'flex w-full items-center gap-6 px-6 py-4 text-left content-md:gap-10';
const QUESTION_CLASS = 'min-w-0 flex-1 break-words';
const CHEVRON_CLASS = 'shrink-0 text-ods-text-primary';
/**
 * Rows the accordion's skeleton draws when not told how many: a typical count for a list of questions whose host
 * states no count (a host that fetches with a count passes it, and the skeleton draws exactly that, at every width).
 */
export const FAQ_ACCORDION_SKELETON_ROWS = 12;
/**
 * Whether a skeleton row's question takes two lines on a phone (one from `content-md`, where a question fits a line).
 * Typically about every other question wraps on a phone: the skeleton alternates, starting with a wrapping row.
 */
const wrapsOnPhone = (index: number) => index % 2 === 0;

export function FaqAccordion({ items, defaultOpenIds = [], loading: loadingProp, skeletonCount }: FaqAccordionProps) {
  const [openSet, setOpenSet] = useState<Set<string | number>>(new Set(defaultOpenIds));
  // In a loading scope the items are the empty record: the accordion is its skeleton.
  const loading = useLoadingScope() || !!loadingProp;
  if (loading) return <FaqAccordionSkeleton count={skeletonCount ?? (items.length || undefined)} />;

  const toggle = (id: string | number) => {
    setOpenSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={ACCORDION_FRAME_CLASS}>
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
            className={cn(ROW_FRAME_CLASS, 'hover:bg-ods-bg-hover')}
            // A question is a read list's row: how many there are is the data's.
            data-loading-item
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
              className={cn(
                ROW_HEADER_CLASS,
                'cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
              )}
            >
              <h3 className={QUESTION_CLASS}>{item.question}</h3>
              <Chevron02DownIcon
                aria-hidden="true"
                size={24}
                className={cn(CHEVRON_CLASS, 'transition-transform duration-300', isOpen && 'rotate-180')}
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

/**
 * The accordion while its questions are read: the bordered list of `count` closed rows, each question a bar (two
 * lines on a phone, one from `content-md`) inside the row's own `h3`, the chevron real.
 */
export function FaqAccordionSkeleton({
  count = FAQ_ACCORDION_SKELETON_ROWS,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn(ACCORDION_FRAME_CLASS, className)} aria-hidden>
      <LoadingItems count={count}>
        {i => (
          <div className={ROW_FRAME_CLASS} data-loading-item>
            <div className={ROW_HEADER_CLASS}>
              <h3 className={QUESTION_CLASS}>
                {/* A typical question's lines: `wrapsOnPhone` on a phone, one from `content-md`. */}
                {wrapsOnPhone(i) ? (
                  <>
                    <TextLineSkeleton type="inherit" as="span" lines={2} className="w-5/6 content-md:hidden" />
                    <TextLineSkeleton type="inherit" as="span" className="hidden w-5/6 content-md:block" />
                  </>
                ) : (
                  <TextLineSkeleton type="inherit" as="span" className="w-5/6" />
                )}
              </h3>
              <Chevron02DownIcon aria-hidden="true" size={24} className={CHEVRON_CLASS} />
            </div>
          </div>
        )}
      </LoadingItems>
    </div>
  );
}
