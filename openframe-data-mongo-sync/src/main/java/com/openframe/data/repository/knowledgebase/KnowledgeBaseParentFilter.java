package com.openframe.data.repository.knowledgebase;

import java.util.Collection;
import java.util.List;

/**
 * Which parents a knowledge base item listing reads from. Three shapes, because "no parent id"
 * means two different things: the root level, or no restriction at all.
 *
 * @param unrestricted every item whatever its parent — the whole knowledge base
 * @param parentIds    the parents to read from; empty (and not unrestricted) means the root level
 */
public record KnowledgeBaseParentFilter(boolean unrestricted, List<String> parentIds) {

    /** Every item, at every level. */
    public static KnowledgeBaseParentFilter any() {
        return new KnowledgeBaseParentFilter(true, List.of());
    }

    /** Items with no parent. */
    public static KnowledgeBaseParentFilter root() {
        return new KnowledgeBaseParentFilter(false, List.of());
    }

    /** Items directly under one of these folders: one id for a level, a folder plus its descendants for a subtree. */
    public static KnowledgeBaseParentFilter of(Collection<String> parentIds) {
        return new KnowledgeBaseParentFilter(false, List.copyOf(parentIds));
    }
}
