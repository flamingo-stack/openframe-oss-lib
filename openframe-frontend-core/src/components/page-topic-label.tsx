'use client';

import { usePageAddress, usePageTopic } from '../contexts/page-topics-context';
import { cn } from '../utils/cn';

export interface PageTopicLabelProps {
  className?: string;
}

/**
 * The page's stamp, a faint label: what the FAQ block prints under its heading
 * and the chat prints by its quick actions, so whoever edits FAQs or quick
 * actions can tell which page this is and what it asks for. A debugging aid,
 * not copy: the badge size at reduced opacity.
 *
 * It prints the page's ADDRESS (`usePageAddress`), the host's mount kept
 * (`/help-center/faqs`). Where a host mounts the hub's pages the page's TOPIC,
 * the path its quick actions and FAQs are tagged with on the hub, differs
 * (`/faqs`): the hover then names it ("Tagged as /faqs"); elsewhere the hover
 * reads "Page topic". ONE label read from ONE source, so the two surfaces can
 * never show different values. Nothing renders when the page has no topic.
 */
export function PageTopicLabel({ className }: PageTopicLabelProps) {
  const topic = usePageTopic();
  const address = usePageAddress();
  if (!topic || !address) return null;
  return (
    <p
      data-page-topic={topic}
      data-page-address={address}
      title={address === topic ? 'Page topic' : `Tagged as ${topic}`}
      className={cn('leading-none text-ods-text-muted opacity-60 text-badge', className)}
    >
      {address}
    </p>
  );
}
