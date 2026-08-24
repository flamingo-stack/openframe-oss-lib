package com.openframe.api.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

/**
 * Page of articles with hasNextPage signal derived from a fetch of size limit+1.
 * Avoids the false-positive `size == limit` check that fails when totalCount % limit == 0.
 */
@Getter
@AllArgsConstructor
public class PagedArticles {
    private final List<KnowledgeBaseItem> items;
    private final boolean hasNextPage;
}
