package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.service.KnowledgeBaseTagService;
import com.openframe.data.document.tag.Tag;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

@DgsDataLoader(name = "knowledgeBaseTagDataLoader")
@RequiredArgsConstructor
public class KnowledgeBaseTagDataLoader implements BatchLoader<String, List<Tag>> {

    private final KnowledgeBaseTagService knowledgeBaseTagService;

    @Override
    public CompletionStage<List<List<Tag>>> load(List<String> itemIds) {
        return CompletableFuture.supplyAsync(() -> knowledgeBaseTagService.getTagsByItemIds(itemIds));
    }
}
