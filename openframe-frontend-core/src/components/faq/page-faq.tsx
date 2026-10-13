'use client';

import type React from 'react';
import type { Faq } from '../../types/faq';
import { cn } from '../../utils/cn';
import { SectionHeading } from '../layout/page-heading';
import { FaqSection, type FaqSectionProps } from './faq-section';
import type { FaqSchemaOptions } from './json-ld';

/** The id of a page's FAQ block: what a page's "FAQ" link or section nav points at. */
export const PAGE_FAQ_SECTION_ID = 'faq';

const DEFAULT_TITLE = 'Frequently Asked Questions';

/** A block of its own between a page's content and its footer: the standard section recipe. */
const FULL_WIDTH_CLASS = 'mx-auto w-full max-w-[1920px] space-y-10 px-6 py-12 md:px-20 md:py-20';
/** Inside a page that already provides the container (a shared page's own shell): vertical rhythm only. */
const CONTAINED_CLASS = 'space-y-10 pt-12 md:pt-20';

export interface PageFaqProps {
  /**
   * What the page is about. REQUIRED, and stated by the page that renders the
   * block: the FAQs shown are the ones written for this topic, and the "ask
   * the assistant" card offers the questions written for it. Never read from
   * the address of the page.
   */
  topic: string;
  /** The host's own read of the topic's FAQs (server-rendered); omitted, the block fetches them. */
  initialFaqs?: Faq[];
  /** Base URL the block appends `/api/faqs` to (reverse-proxy embedders). */
  apiBaseUrl?: string;
  /** The block's title. Default "Frequently Asked Questions". */
  title?: string;
  /** A whole heading node in place of the titled one (a landing page's own lines). */
  heading?: React.ReactNode;
  /** True inside a page that already provides the container: no width or side padding of its own. */
  contained?: boolean;
  /**
   * Print the topic's bare name in small muted text under the heading
   * (`pricing`), so whoever edits the FAQs can see which topic a page asks
   * for. Default off. The block always carries it as `data-faq-topic` too.
   */
  showTopic?: boolean;
  /** Emit FAQPage JSON-LD for the page's own questions. Default true: they are this page's. */
  emitJsonLd?: boolean;
  jsonLd?: FaqSchemaOptions;
  /** The "ask the assistant" card (see `FaqSection`). Its topic is the block's unless stated. */
  ask?: FaqSectionProps['ask'];
  className?: string;
}

/**
 * What a shared page of the lib takes as its `faq` prop: the topic (REQUIRED),
 * and where its host serves the FAQs. The page renders the block inside its
 * own container, after its content.
 */
export type PageFaqSlot = Pick<
  PageFaqProps,
  'topic' | 'apiBaseUrl' | 'initialFaqs' | 'title' | 'ask' | 'emitJsonLd' | 'jsonLd'
>;

/** A shared page's FAQ block: nothing without a `faq` prop, else the block inside the page's own container. */
export function PageFaqInPage({ faq }: { faq?: PageFaqSlot }) {
  return faq ? <PageFaq {...faq} contained /> : null;
}

/**
 * A page's own FAQ block: the questions written for the page's `topic`, with
 * the "ask the assistant" card for the same topic, as one section a page
 * places where it wants it (the last block before the footer, by convention).
 * The one way a page shows topic FAQs, on every host: a host that reads on the
 * server passes `initialFaqs`; any other lets the block fetch
 * `/api/faqs?topic=`. A topic with no FAQ renders nothing at all.
 */
export function PageFaq({
  topic,
  initialFaqs,
  apiBaseUrl,
  title = DEFAULT_TITLE,
  heading,
  contained = false,
  showTopic = false,
  emitJsonLd = true,
  jsonLd,
  ask,
  className,
}: PageFaqProps) {
  const headingNode = heading ?? <SectionHeading title={title} punctuation={null} />;
  return (
    <FaqSection
      id={PAGE_FAQ_SECTION_ID}
      topic={topic}
      initialFaqs={initialFaqs}
      apiBaseUrl={apiBaseUrl}
      heading={
        showTopic ? (
          <div className="space-y-1">
            {headingNode}
            <p className="text-ods-text-muted text-h6">{topic}</p>
          </div>
        ) : (
          headingNode
        )
      }
      emitJsonLd={emitJsonLd}
      jsonLd={jsonLd}
      ask={ask}
      className={cn(contained ? CONTAINED_CLASS : FULL_WIDTH_CLASS, className)}
    />
  );
}
