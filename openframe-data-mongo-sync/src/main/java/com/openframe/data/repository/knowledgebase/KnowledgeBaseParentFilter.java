package com.openframe.data.repository.knowledgebase;

import java.util.Collection;
import java.util.List;

// "no parent id" is ambiguous: unrestricted covers the whole knowledge base, non-unrestricted with empty parentIds means the root level
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
