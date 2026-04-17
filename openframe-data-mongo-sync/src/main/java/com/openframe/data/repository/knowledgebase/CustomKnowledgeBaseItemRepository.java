package com.openframe.data.repository.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;

import java.util.List;

public interface CustomKnowledgeBaseItemRepository {

    List<KnowledgeBaseItem> searchPublishedArticles(String search, String folderId);

    List<String> findDistinctFolderNames();
}
