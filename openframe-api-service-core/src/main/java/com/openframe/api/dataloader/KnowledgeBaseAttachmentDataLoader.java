package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemAttachmentRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

@DgsDataLoader(name = "knowledgeBaseAttachmentDataLoader")
@RequiredArgsConstructor
public class KnowledgeBaseAttachmentDataLoader implements BatchLoader<String, List<KnowledgeBaseItemAttachment>> {

    private final KnowledgeBaseItemAttachmentRepository attachmentRepository;

    @Override
    public CompletionStage<List<List<KnowledgeBaseItemAttachment>>> load(List<String> itemIds) {
        return CompletableFuture.supplyAsync(() -> {
            List<KnowledgeBaseItemAttachment> attachments = attachmentRepository.findByItemIdIn(itemIds);
            Map<String, List<KnowledgeBaseItemAttachment>> grouped = attachments.stream()
                    .collect(Collectors.groupingBy(KnowledgeBaseItemAttachment::getItemId));
            return itemIds.stream()
                    .map(id -> grouped.getOrDefault(id, List.of()))
                    .toList();
        });
    }
}
