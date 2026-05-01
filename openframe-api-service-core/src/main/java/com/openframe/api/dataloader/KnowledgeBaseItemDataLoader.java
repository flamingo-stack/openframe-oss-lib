package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * DataLoader for batch loading KnowledgeBaseItem objects by id.
 * Used by AssignableTarget polymorphic resolution for KNOWLEDGE_ARTICLE target type.
 */
@DgsDataLoader(name = "knowledgeBaseItemDataLoader")
@RequiredArgsConstructor
public class KnowledgeBaseItemDataLoader implements BatchLoader<String, KnowledgeBaseItem> {

    private final KnowledgeBaseItemRepository knowledgeBaseItemRepository;

    @Override
    public CompletionStage<List<KnowledgeBaseItem>> load(List<String> itemIds) {
        return CompletableFuture.supplyAsync(() -> {
            Set<String> nonNullIds = itemIds.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (nonNullIds.isEmpty()) {
                return itemIds.stream()
                        .map(id -> (KnowledgeBaseItem) null)
                        .collect(Collectors.toList());
            }

            List<KnowledgeBaseItem> items = knowledgeBaseItemRepository.findByIdIn(new ArrayList<>(nonNullIds));
            Map<String, KnowledgeBaseItem> itemMap = items.stream()
                    .collect(Collectors.toMap(KnowledgeBaseItem::getId, item -> item));

            return itemIds.stream()
                    .map(id -> id == null ? null : itemMap.get(id))
                    .collect(Collectors.toList());
        });
    }
}
