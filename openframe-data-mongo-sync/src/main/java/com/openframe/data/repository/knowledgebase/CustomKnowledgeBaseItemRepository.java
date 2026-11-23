package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;

import java.util.List;
import java.util.Optional;

public interface CustomKnowledgeBaseItemRepository {

    /**
     * Folders past {@code cursor} in the fetch direction (null = from that end). Forward they are
     * ordered by name asc, _id desc — the name compared case-insensitively and with digits by
     * value; backward by the reverse of it.
     */
    List<KnowledgeBaseItem> findFolders(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                                        KnowledgeBaseItemCursor cursor, boolean backward, int limit);

    long countFolders(KnowledgeBaseParentFilter parent, String search, List<String> itemIds);

    /**
     * Articles past {@code cursor} in the fetch direction (null = from that end). Forward they are
     * ordered by updatedAt desc, _id desc; backward by the reverse of it. Without {@code statuses}
     * every article but the archived ones.
     */
    List<KnowledgeBaseItem> findArticles(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                                         List<KnowledgeBaseArticleStatus> statuses,
                                         KnowledgeBaseItemCursor cursor, boolean backward, int limit);

    long countArticles(KnowledgeBaseParentFilter parent, String search, List<String> itemIds,
                       List<KnowledgeBaseArticleStatus> statuses);

    /** Every folder with only its id and parentId loaded — what resolving a subtree needs. */
    List<KnowledgeBaseItem> findFolderLinks();

    List<KnowledgeBaseItem> findArchivedArticles(String search, List<String> itemIds,
                                                  KnowledgeBaseItemCursor cursor, boolean backward, int limit);

    long countArchivedArticles(String search, List<String> itemIds);

    List<KnowledgeBaseItem> findAllArticles();

    Optional<KnowledgeBaseItem> findCursorItem(String id);
}
