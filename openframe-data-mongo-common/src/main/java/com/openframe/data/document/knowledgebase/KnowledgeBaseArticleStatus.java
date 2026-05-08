package com.openframe.data.document.knowledgebase;

/**
 * Publication / lifecycle status of a Knowledge Base article.
 * Articles are never hard-deleted — ARCHIVED is the soft-delete terminal state.
 * Folders never use this enum (they are hard-deleted).
 */
public enum KnowledgeBaseArticleStatus {
    DRAFT,
    PUBLISHED,
    ARCHIVED
}
