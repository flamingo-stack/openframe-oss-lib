package com.openframe.api.service.knowledgebase;

import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import static com.openframe.api.service.knowledgebase.KnowledgeBaseService.targetTypeOf;
import static com.openframe.data.document.audit.AuditAction.KB_ITEM_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.KB_ITEM_TAG_REMOVE;
import static org.springframework.util.CollectionUtils.isEmpty;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KnowledgeBaseTagService {

    private static final TagEntityType ENTITY_TYPE = TagEntityType.KNOWLEDGE_ARTICLE;

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final KnowledgeBaseItemRepository itemRepository;
    private final AuditedMethodRunner auditedMethodRunner;

    public List<Tag> getAllTags(boolean archived) {
        List<TagAssignment> assignments = tagAssignmentRepository.findByEntityType(ENTITY_TYPE);
        if (assignments.isEmpty()) {
            return List.of();
        }

        Set<String> itemIds = assignments.stream()
                .map(TagAssignment::getEntityId)
                .collect(Collectors.toSet());

        Set<String> matchingItemIds = itemRepository.findAllById(itemIds).stream()
                .filter(item -> archived
                        ? item.getStatus() == KnowledgeBaseArticleStatus.ARCHIVED
                        : item.getStatus() != KnowledgeBaseArticleStatus.ARCHIVED)
                .map(KnowledgeBaseItem::getId)
                .collect(Collectors.toSet());

        Set<String> tagIds = assignments.stream()
                .filter(a -> matchingItemIds.contains(a.getEntityId()))
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());

        return tagIds.isEmpty() ? List.of() : tagRepository.findAllById(tagIds);
    }

    public List<Tag> getTagsForItemIds(List<String> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) {
            return List.of();
        }
        Set<String> tagIds = tagAssignmentRepository
                .findByEntityIdInAndEntityType(itemIds, ENTITY_TYPE)
                .stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());
        return tagIds.isEmpty() ? List.of() : tagRepository.findAllById(tagIds);
    }

    public List<String> findItemIdsByTags(List<String> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return null;
        }
        return tagAssignmentRepository.findByTagIdInAndEntityType(tagIds, ENTITY_TYPE)
                .stream()
                .map(TagAssignment::getEntityId)
                .distinct()
                .toList();
    }

    @Transactional
    public void addTagToItem(String itemId, String tagId) {
        log.info("Adding tag {} to KB item {}", tagId, itemId);
        KnowledgeBaseItem item = itemRepository.findById(itemId).orElse(null);
        Tag tag = tagRepository.findById(tagId).orElse(null);
        auditedMethodRunner.runWhenChanged(KB_ITEM_TAG_ADD, targetTypeOf(item), itemId, tagDetails(tagId, tag),
                () -> {
                    if (tag == null) {
                        throw tagNotFound(tagId);
                    }
                    if (item == null) {
                        throw itemNotFound(itemId);
                    }
                    return assignTag(itemId, tagId);
                });
    }

    private static Map<String, Object> tagDetails(String tagId, Tag tag) {
        Map<String, Object> details = new HashMap<>(Map.of("tagIds", List.of(tagId)));
        if (tag != null) {
            details.put("tagKeys", List.of(tag.getKey()));
        }
        return details;
    }

    private static NotFoundException tagNotFound(String tagId) {
        return new NotFoundException(ErrorCode.TAG_NOT_FOUND, "Tag not found: " + tagId);
    }

    private static NotFoundException itemNotFound(String itemId) {
        return new NotFoundException(ErrorCode.KNOWLEDGE_BASE_ITEM_NOT_FOUND,
                "Knowledge base item not found: " + itemId);
    }

    private boolean assignTag(String itemId, String tagId) {
        if (isAssigned(itemId, tagId)) {
            return false;
        }
        TagAssignment assignment = TagAssignment.builder()
                .entityId(itemId)
                .tagId(tagId)
                .entityType(ENTITY_TYPE)
                .build();
        tagAssignmentRepository.save(assignment);
        return true;
    }

    private boolean unassignTag(String itemId, String tagId) {
        boolean assigned = isAssigned(itemId, tagId);
        tagAssignmentRepository.deleteByEntityIdAndTagIdAndEntityType(itemId, tagId, ENTITY_TYPE);
        return assigned;
    }

    private boolean isAssigned(String itemId, String tagId) {
        return tagAssignmentRepository.findByEntityIdAndTagIdAndEntityType(itemId, tagId, ENTITY_TYPE).isPresent();
    }

    public void requireExistingTags(List<String> tagIds) {
        if (isEmpty(tagIds)) {
            return;
        }
        tagIds.forEach(this::requireExistingTag);
    }

    public void requireTagAttachment(String itemId, String tagId) {
        requireExistingTag(tagId);
        if (!itemRepository.existsById(itemId)) {
            throw itemNotFound(itemId);
        }
    }

    private void requireExistingTag(String tagId) {
        if (!tagRepository.existsById(tagId)) {
            throw tagNotFound(tagId);
        }
    }

    @Transactional
    public void removeTagFromItem(String itemId, String tagId) {
        log.info("Removing tag {} from KB item {}", tagId, itemId);
        AuditTargetType targetType = targetTypeOf(itemRepository.findById(itemId).orElse(null));
        Map<String, Object> details = tagDetails(tagId, tagRepository.findById(tagId).orElse(null));
        auditedMethodRunner.runWhenChanged(KB_ITEM_TAG_REMOVE, targetType, itemId, details,
                () -> unassignTag(itemId, tagId));
    }

    /** Makes the item's tags exactly {@code tagIds}: adds the missing ones and removes the rest. */
    @Transactional
    public void replaceItemTags(String itemId, List<String> tagIds) {
        // Validate first so an unknown tag cannot leave the item with its old tags half removed.
        requireExistingTags(tagIds);
        Set<String> wanted = new LinkedHashSet<>(tagIds);
        Set<String> current = tagAssignmentRepository.findByEntityIdAndEntityType(itemId, ENTITY_TYPE).stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());

        current.stream()
                .filter(tagId -> !wanted.contains(tagId))
                .forEach(tagId -> removeTagFromItem(itemId, tagId));
        wanted.stream()
                .filter(tagId -> !current.contains(tagId))
                .forEach(tagId -> addTagToItem(itemId, tagId));
    }

    public List<List<Tag>> getTagsByItemIds(List<String> itemIds) {
        List<TagAssignment> assignments = tagAssignmentRepository.findByEntityIdInAndEntityType(itemIds, ENTITY_TYPE);

        Set<String> tagIds = assignments.stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());

        Map<String, Tag> tagMap = tagRepository.findAllById(tagIds).stream()
                .collect(Collectors.toMap(Tag::getId, t -> t));

        Map<String, List<Tag>> itemTagMap = assignments.stream()
                .collect(Collectors.groupingBy(
                        TagAssignment::getEntityId,
                        Collectors.mapping(a -> tagMap.get(a.getTagId()),
                                Collectors.filtering(Objects::nonNull, Collectors.toList()))
                ));

        return itemIds.stream()
                .map(id -> itemTagMap.getOrDefault(id, List.of()))
                .toList();
    }
}
