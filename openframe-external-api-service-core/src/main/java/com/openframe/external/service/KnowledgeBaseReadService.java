package com.openframe.external.service;

import com.openframe.api.service.knowledgebase.KnowledgeBaseAttachmentService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTagService;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemAttachment;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.external.dto.knowledgebase.KnowledgeBaseItemResponse;
import com.openframe.external.exception.KnowledgeBaseItemNotFoundException;
import com.openframe.external.mapper.KnowledgeBaseMapper;
import com.openframe.external.mapper.KnowledgeBaseMapper.ItemRelations;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.IntStream;

/**
 * Assembles full knowledge base item representations (tags and attachment metadata) for the
 * REST API, batching the related lookups per page. Also the place where an unknown id turns into
 * a 404: the shared domain services report it as a generic bad-argument error, which the
 * dashboard's GraphQL layer surfaces as a payload error but a REST contract must answer with 404.
 */
@Service
@RequiredArgsConstructor
public class KnowledgeBaseReadService {

    private final KnowledgeBaseService knowledgeBaseService;
    private final KnowledgeBaseTagService knowledgeBaseTagService;
    private final KnowledgeBaseAttachmentService knowledgeBaseAttachmentService;
    private final TagRepository tagRepository;
    private final KnowledgeBaseMapper knowledgeBaseMapper;

    public KnowledgeBaseItem requireItem(String id) {
        return knowledgeBaseService.getItem(id)
                .orElseThrow(() -> new KnowledgeBaseItemNotFoundException(id));
    }

    /** 404 for an unknown id, and also for an id of the other item kind (a folder id on an article route). */
    public KnowledgeBaseItem requireItem(String id, KnowledgeBaseItemType type) {
        KnowledgeBaseItem item = requireItem(id);
        if (item.getType() != type) {
            throw new KnowledgeBaseItemNotFoundException(id);
        }
        return item;
    }

    /** 404 unless the id is a knowledge base tag (tags of other entity types are invisible here). */
    public Tag requireTag(String tagId) {
        return tagRepository.findById(tagId)
                .filter(tag -> tag.getEntityType() == TagEntityType.KNOWLEDGE_ARTICLE)
                .orElseThrow(() -> new NotFoundException(ErrorCode.TAG_NOT_FOUND, "Tag not found: " + tagId));
    }

    /** Single-item variant: includes the article content. */
    public KnowledgeBaseItemResponse toResponse(KnowledgeBaseItem item) {
        return toResponses(List.of(item), true).getFirst();
    }

    /** List variant: skips the (potentially large) markdown content. */
    public List<KnowledgeBaseItemResponse> toResponses(List<KnowledgeBaseItem> items) {
        return toResponses(items, false);
    }

    private List<KnowledgeBaseItemResponse> toResponses(List<KnowledgeBaseItem> items, boolean includeContent) {
        if (items.isEmpty()) {
            return List.of();
        }
        List<String> itemIds = items.stream().map(KnowledgeBaseItem::getId).toList();
        List<List<Tag>> tagsPerItem = knowledgeBaseTagService.getTagsByItemIds(itemIds);
        List<List<KnowledgeBaseItemAttachment>> attachmentsPerItem =
                knowledgeBaseAttachmentService.getAttachmentsByArticleIds(itemIds);
        return IntStream.range(0, items.size())
                .mapToObj(i -> knowledgeBaseMapper.toItemResponse(
                        items.get(i),
                        new ItemRelations(tagsPerItem.get(i), attachmentsPerItem.get(i)),
                        includeContent))
                .toList();
    }
}
