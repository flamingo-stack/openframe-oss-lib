package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.service.KnowledgeBaseAttachmentService;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

@DgsDataLoader(name = "knowledgeBaseAttachmentDataLoader")
@RequiredArgsConstructor
@Slf4j
public class KnowledgeBaseAttachmentDataLoader implements BatchLoader<String, List<KnowledgeBaseItemAttachment>> {

    private final KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;

    @Override
    public CompletionStage<List<List<KnowledgeBaseItemAttachment>>> load(List<String> itemIds) {
        log.debug("Batch loading attachments for {} Knowledge Base items", itemIds.size());
        return CompletableFuture.supplyAsync(() -> knowledgeBaseAttachmentService.getAttachmentsByArticleIds(itemIds));
    }
}
