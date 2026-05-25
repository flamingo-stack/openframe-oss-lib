package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;

import java.util.List;

public interface CustomKnowledgeBaseItemRepository {

    List<KnowledgeBaseItem> findFoldersForParent(String parentId, String search, List<String> itemIds);

    List<KnowledgeBaseItem> findArticles(String parentId, String search,
                                          KnowledgeBaseItemType type, List<String> itemIds,
                                          String cursor, int limit);

    long countArticles(String parentId, String search,
                       KnowledgeBaseItemType type, List<String> itemIds);

    List<KnowledgeBaseItem> findArchivedArticles(String search, List<String> itemIds,
                                                  String cursor, int limit);

    long countArchivedArticles(String search, List<String> itemIds);

    List<KnowledgeBaseItem> findAllArticles();
}
