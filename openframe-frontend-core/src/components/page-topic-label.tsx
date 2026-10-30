'use client';

import { usePageTopic } from '../contexts/page-topics-context';
import { cn } from '../utils/cn';

export interface PageTopicLabelProps {
  className?: string;
}

/**
 * The page's topic (`usePageTopic`) as a faint stamp: what the FAQ block prints
 * under its heading and the chat prints by its quick actions, so whoever edits
 * FAQs or quick actions can check which topic a page asks for. A debugging aid,
 * not copy: the badge size at reduced opacity, named on hover. ONE label read
 * from ONE source, so the two surfaces can never show different topics. Nothing
 * renders when the page has no topic.
 */
export function PageTopicLabel({ className }: PageTopicLabelProps) {
  const topic = usePageTopic();
  if (!topic) return null;
  return (
    <p
      data-page-topic={topic}
      title="Page topic"
      className={cn('leading-none text-ods-text-muted opacity-60 text-badge', className)}
    >
      {topic}
    </p>
  );
}
