package com.openframe.api.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;

import java.util.List;

/**
 * Page of articles with hasNextPage signal derived from a fetch of size limit+1.
 * Avoids the false-positive `size == limit` check that fails when totalCount % limit == 0.
 */
public record PagedArticles(List<KnowledgeBaseItem> items, boolean hasNextPage) {
}
