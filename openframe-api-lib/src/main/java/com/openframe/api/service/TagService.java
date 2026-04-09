package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@Transactional(readOnly = true)
public class TagService {

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;

    public TagService(TagRepository tagRepository, TagAssignmentRepository tagAssignmentRepository) {
        this.tagRepository = tagRepository;
        this.tagAssignmentRepository = tagAssignmentRepository;
    }

    public Optional<Tag> findById(String id) {
        return tagRepository.findById(id);
    }

    public List<Tag> listTags(String organizationId) {
        log.debug("Listing device tags for org: {}", organizationId);
        return tagRepository.findByOrganizationIdAndEntityType(organizationId, TagEntityType.DEVICE);
    }

    /**
     * Search tag keys for autocomplete with limit, scoped to DEVICE entity type.
     * If search is null or blank, returns all device tags for the organization.
     */
    public List<Tag> searchTagKeys(String organizationId, String search, Integer limit) {
        log.debug("Searching device tag keys for org: {}, search: {}, limit: {}", organizationId, search, limit);

        List<Tag> allMatches;
        if (search == null || search.isBlank()) {
            allMatches = tagRepository.findByOrganizationIdAndEntityType(organizationId, TagEntityType.DEVICE);
        } else {
            allMatches = tagRepository.findByOrganizationIdAndEntityTypeAndKeyContainingIgnoreCase(
                    organizationId, TagEntityType.DEVICE, search);
        }

        return allMatches.stream()
                .limit(normalizeLimit(limit))
                .toList();
    }

    /**
     * Search tag values for autocomplete with limit.
     * If search is null or blank, returns all values for the tag key.
     */
    public List<String> searchTagValues(String organizationId, String tagKey, String search, Integer limit) {
        log.debug("Searching device tag values for org: {}, key: {}, search: {}, limit: {}",
                organizationId, tagKey, search, limit);

        Tag tag = tagRepository.findValuesByKeyAndOrganizationIdAndEntityType(tagKey, organizationId, TagEntityType.DEVICE);
        if (tag == null || tag.getValues() == null || tag.getValues().isEmpty()) {
            return List.of();
        }

        List<String> allMatches;
        if (search == null || search.isBlank()) {
            allMatches = tag.getValues();
        } else {
            String lowerSearch = search.toLowerCase();
            allMatches = tag.getValues().stream()
                    .filter(v -> v.toLowerCase().contains(lowerSearch))
                    .toList();
        }

        return allMatches.stream()
                .limit(normalizeLimit(limit))
                .toList();
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit < 1) return DEFAULT_LIMIT;
        return Math.min(limit, MAX_LIMIT);
    }

    /**
     * Get all distinct values for a specific tag key with device counts.
     * Used to populate the "Select Tag Value" dropdown in the filter UI.
     */
    public List<DeviceFilterOption> getTagValueOptions(String tagKey) {
        log.debug("Getting tag value options for key: {}", tagKey);

        List<Tag> tags = tagRepository.findByKeyInAndEntityType(List.of(tagKey), TagEntityType.DEVICE);
        if (tags.isEmpty()) {
            return List.of();
        }

        List<String> tagIds = tags.stream().map(Tag::getId).toList();

        List<TagAssignment> tagAssignments = tagAssignmentRepository
                .findByTagIdInAndEntityType(tagIds, TagEntityType.DEVICE);

        Map<String, Integer> valueCounts = new LinkedHashMap<>();
        for (TagAssignment assignment : tagAssignments) {
            if (assignment.getValues() != null) {
                for (String value : assignment.getValues()) {
                    valueCounts.merge(value, 1, Integer::sum);
                }
            }
        }

        return valueCounts.entrySet().stream()
                .map(entry -> DeviceFilterOption.builder()
                        .value(entry.getKey())
                        .label(entry.getKey())
                        .count(entry.getValue())
                        .build())
                .sorted(Comparator.comparing(DeviceFilterOption::getValue))
                .toList();
    }

    /**
     * Get tags for multiple machines (batch loading).
     * Returns Tag objects enriched with per-device values from TagAssignment.
     */
    public List<List<Tag>> getTagsForMachines(List<String> machineIds) {
        log.debug("Getting tags for {} machines", machineIds.size());

        if (machineIds.isEmpty()) {
            return new ArrayList<>();
        }

        List<TagAssignment> allAssignments = tagAssignmentRepository
                .findByEntityIdInAndEntityType(machineIds, TagEntityType.DEVICE);

        if (allAssignments.isEmpty()) {
            return machineIds.stream()
                    .map(id -> new ArrayList<Tag>())
                    .collect(Collectors.toList());
        }

        Map<String, List<TagAssignment>> assignmentsByEntityId = allAssignments.stream()
                .collect(Collectors.groupingBy(TagAssignment::getEntityId));

        Set<String> allTagIds = allAssignments.stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());
        List<Tag> allTags = tagRepository.findAllById(new ArrayList<>(allTagIds));
        Map<String, Tag> tagsById = allTags.stream()
                .collect(Collectors.toMap(Tag::getId, tag -> tag));

        return machineIds.stream()
                .map(machineId -> {
                    List<TagAssignment> assignments = assignmentsByEntityId
                            .getOrDefault(machineId, List.of());
                    return assignments.stream()
                            .map(assignment -> buildTag(assignment, tagsById.get(assignment.getTagId())))
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList());
                })
                .collect(Collectors.toList());
    }

    /**
     * Get tags for a single machine.
     */
    public List<Tag> getTagsForMachine(String machineId) {
        log.debug("Getting tags for machine: {}", machineId);

        List<TagAssignment> assignments = tagAssignmentRepository
                .findByEntityIdAndEntityType(machineId, TagEntityType.DEVICE);
        if (assignments.isEmpty()) {
            return new ArrayList<>();
        }

        List<String> tagIds = assignments.stream()
                .map(TagAssignment::getTagId)
                .toList();
        List<Tag> tags = tagRepository.findAllById(tagIds);
        Map<String, Tag> tagsById = tags.stream()
                .collect(Collectors.toMap(Tag::getId, tag -> tag));

        return assignments.stream()
                .map(assignment -> buildTag(assignment, tagsById.get(assignment.getTagId())))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private Tag buildTag(TagAssignment assignment, Tag tag) {
        if (tag == null) {
            log.warn("Tag not found for assignment: {}", assignment.getTagId());
            return null;
        }

        return Tag.builder()
                .id(tag.getId())
                .key(tag.getKey())
                .description(tag.getDescription())
                .color(tag.getColor())
                .values(assignment.getValues() != null ? assignment.getValues() : List.of())
                .entityType(tag.getEntityType())
                .organizationId(tag.getOrganizationId())
                .createdAt(assignment.getTaggedAt())
                .build();
    }
}
