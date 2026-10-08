package com.openframe.api.dto.knowledgebase;

/**
 * How far below the filter's parentId an item listing looks. "No parentId" alone cannot say it:
 * it already means the root level, so it cannot also mean every level.
 *
 * CHILDREN — the items directly under parentId (the root level without one).
 * DESCENDANTS — everything under parentId at any depth (the whole knowledge base without one).
 *
 * Folders and articles always share the scope. A listing asked without one reads CHILDREN, or
 * DESCENDANTS when it carries a search or a tag filter.
 */
public enum KnowledgeBaseScope {
    CHILDREN,
    DESCENDANTS
}
