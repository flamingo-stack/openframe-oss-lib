package com.openframe.api.dto.knowledgebase;

/**
 * How far below the filter's parentId an item listing looks. "No parentId" alone cannot say it:
 * it already means the root level, so it cannot also mean every level.
 *
 * CHILDREN — the items directly under parentId (the root level without one).
 * DESCENDANTS — everything under parentId at any depth (the whole knowledge base without one).
 *
 * A listing asked without a scope keeps the rules that predate it: one level, except that a search
 * or a tag filter returns the matching articles of the whole subtree and no folders.
 */
public enum KnowledgeBaseScope {
    CHILDREN,
    DESCENDANTS
}
