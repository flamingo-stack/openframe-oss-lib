package com.openframe.api.service;

import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KnowledgeBaseTagService {

    private static final TagEntityType ENTITY_TYPE = TagEntityType.KNOWLEDGE_ARTICLE;

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;

    public List<Tag> getAllTags() {
        return tagRepository.findByEntityType(ENTITY_TYPE);
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
        TagAssignment assignment = TagAssignment.builder()
                .entityId(itemId)
                .tagId(tagId)
                .entityType(ENTITY_TYPE)
                .build();
        tagAssignmentRepository.save(assignment);
    }

    @Transactional
    public void removeTagFromItem(String itemId, String tagId) {
        log.info("Removing tag {} from KB item {}", tagId, itemId);
        tagAssignmentRepository.deleteByEntityIdAndTagIdAndEntityType(itemId, tagId, ENTITY_TYPE);
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
