'use client';

import { useMemo } from 'react';
import { KnowledgeBaseArticleView } from '../../features/knowledge-base';
import { SimpleMarkdownRenderer } from '../../ui/markdown/simple-markdown-renderer';
import { useProductDemoCast } from '../cast';
import { buildKnowledgeFixture } from '../fixtures/knowledge';
import type { ProductScreenViewProps } from '../types';

/**
 * The product's Knowledge Base with one article open: a client's runbook, its
 * author and status, and the steps. A list of file names says nothing about
 * the job; an open runbook does. The title is the article's own name, the one
 * line that says what is open; the page's buttons are left out.
 */
export default function KnowledgeScreen(_props: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildKnowledgeFixture(cast), [cast]);
  return (
    <div className="h-full bg-ods-bg">
      <KnowledgeBaseArticleView
        {...fixture.article}
        content={<SimpleMarkdownRenderer content={fixture.content} textSize="compact" />}
      />
    </div>
  );
}
