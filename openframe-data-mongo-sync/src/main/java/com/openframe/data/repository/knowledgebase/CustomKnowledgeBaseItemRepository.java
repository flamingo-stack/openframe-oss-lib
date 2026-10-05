package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;

import java.util.List;

public interface CustomKnowledgeBaseItemRepository {

    /**
     * Folders after {@code cursor} (null = from the start), ordered by name asc, _id desc — the name
     * compared case-insensitively and with digits by value.
     */
    List<KnowledgeBaseItem> findFolders(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                                        KnowledgeBaseItemCursor cursor, int limit);

    long countFolders(KnowledgeBaseParentFilter parent, String search, List<String> itemIds);

    /**
     * Articles after {@code cursor} (null = from the start), ordered by updatedAt desc, _id desc.
     * Without {@code statuses} every article but the archived ones.
     */
    List<KnowledgeBaseItem> findArticles(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                                         List<KnowledgeBaseArticleStatus> statuses,
                                         KnowledgeBaseItemCursor cursor, int limit);

    long countArticles(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                       List<KnowledgeBaseArticleStatus> statuses);

    /** Every folder with only its id and parentId loaded — what resolving a subtree needs. */
    List<KnowledgeBaseItem> findFolderLinks();

    List<KnowledgeBaseItem> findArchivedArticles(String search, List<String> itemIds,
                                                  KnowledgeBaseItemCursor cursor, int limit);

    long countArchivedArticles(String search, List<String> itemIds);

    List<KnowledgeBaseItem> findAllArticles();
}
