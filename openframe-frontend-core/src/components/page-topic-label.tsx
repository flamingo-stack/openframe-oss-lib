'use client';

import { usePageTopic } from '../contexts/page-topics-context';
import { cn } from '../utils/cn';

export interface PageTopicLabelProps {
  className?: string;
}

/**
 * The page's topic (`usePageTopic`), as its bare name in small muted text: what
 * the FAQ block prints under its heading and the chat prints above its quick
 * actions, so whoever edits FAQs or quick actions sees which topic the page asks
 * for. ONE label read from ONE source, so the two can never show different
 * topics. Nothing renders when the page has no topic.
 */
export function PageTopicLabel({ className }: PageTopicLabelProps) {
  const topic = usePageTopic();
  if (!topic) return null;
  return (
    <p data-page-topic={topic} className={cn('text-ods-text-muted text-h6', className)}>
      {topic}
    </p>
  );
}
