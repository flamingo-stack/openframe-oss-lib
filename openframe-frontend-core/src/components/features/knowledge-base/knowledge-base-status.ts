/**
 * THE status vocabulary of a knowledge base article and the tag each status
 * wears. The article view and the table both read it: a new status is added
 * here, once.
 */
export type KnowledgeBaseArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const KNOWLEDGE_BASE_STATUS_VARIANT: Record<KnowledgeBaseArticleStatus, 'success' | 'warning' | 'grey'> = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
  ARCHIVED: 'grey',
};
