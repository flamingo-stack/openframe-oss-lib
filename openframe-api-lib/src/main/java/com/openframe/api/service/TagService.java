package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.data.document.device.MachineTag;
import com.openframe.data.document.tool.Tag;
import com.openframe.data.repository.device.MachineTagRepository;
import com.openframe.data.repository.tool.TagRepository;
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
    private final MachineTagRepository machineTagRepository;
    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 100;

    public TagService(TagRepository tagRepository, MachineTagRepository machineTagRepository) {
        this.tagRepository = tagRepository;
        this.machineTagRepository = machineTagRepository;
    }

    public Optional<Tag> findById(String id) {
        return tagRepository.findById(id);
    }

    public List<Tag> listTags(String organizationId) {
        log.debug("Listing tags for org: {}", organizationId);
        return tagRepository.findByOrganizationId(organizationId);
    }

    /**
     * Search tag keys for autocomplete with limit.
     * If search is null or blank, returns all tags for the organization.
     */
    public List<Tag> searchTagKeys(String organizationId, String search, Integer limit) {
        log.debug("Searching tag keys for org: {}, search: {}, limit: {}", organizationId, search, limit);

        List<Tag> allMatches;
        if (search == null || search.isBlank()) {
            allMatches = tagRepository.findByOrganizationId(organizationId);
        } else {
            allMatches = tagRepository.findByOrganizationIdAndKeyContainingIgnoreCase(organizationId, search);
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
        log.debug("Searching tag values for org: {}, key: {}, search: {}, limit: {}",
                organizationId, tagKey, search, limit);

        Tag tag = tagRepository.findValuesByKeyAndOrganizationId(tagKey, organizationId);
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

        List<Tag> tags = tagRepository.findByKeyIn(List.of(tagKey));
        if (tags.isEmpty()) {
            return List.of();
        }

        List<String> tagIds = tags.stream().map(Tag::getId).toList();

        List<MachineTag> machineTags = machineTagRepository.findByTagIdIn(tagIds);

        Map<String, Integer> valueCounts = new LinkedHashMap<>();
        for (MachineTag mt : machineTags) {
            if (mt.getValues() != null) {
                for (String value : mt.getValues()) {
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
     * Returns Tag objects enriched with per-device values from MachineTag.
     */
    public List<List<Tag>> getTagsForMachines(List<String> machineIds) {
        log.debug("Getting tags for {} machines", machineIds.size());

        if (machineIds.isEmpty()) {
            return new ArrayList<>();
        }

        List<MachineTag> allMachineTags = machineTagRepository.findByMachineIdIn(machineIds);

        if (allMachineTags.isEmpty()) {
            return machineIds.stream()
                    .map(id -> new ArrayList<Tag>())
                    .collect(Collectors.toList());
        }

        Map<String, List<MachineTag>> machineTagsByMachineId = allMachineTags.stream()
                .collect(Collectors.groupingBy(MachineTag::getMachineId));

        Set<String> allTagIds = allMachineTags.stream()
                .map(MachineTag::getTagId)
                .collect(Collectors.toSet());
        List<Tag> allTags = tagRepository.findAllById(new ArrayList<>(allTagIds));
        Map<String, Tag> tagsById = allTags.stream()
                .collect(Collectors.toMap(Tag::getId, tag -> tag));

        return machineIds.stream()
                .map(machineId -> {
                    List<MachineTag> machineTags = machineTagsByMachineId
                            .getOrDefault(machineId, List.of());
                    return machineTags.stream()
                            .map(mt -> buildTag(mt, tagsById.get(mt.getTagId())))
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

        List<MachineTag> machineTags = machineTagRepository.findByMachineId(machineId);
        if (machineTags.isEmpty()) {
            return new ArrayList<>();
        }

        List<String> tagIds = machineTags.stream()
                .map(MachineTag::getTagId)
                .toList();
        List<Tag> tags = tagRepository.findAllById(tagIds);
        Map<String, Tag> tagsById = tags.stream()
                .collect(Collectors.toMap(Tag::getId, tag -> tag));

        return machineTags.stream()
                .map(mt -> buildTag(mt, tagsById.get(mt.getTagId())))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private Tag buildTag(MachineTag machineTag, Tag tag) {
        if (tag == null) {
            log.warn("Tag not found for machineTag: {}", machineTag.getTagId());
            return null;
        }

        return Tag.builder()
                .id(tag.getId())
                .key(tag.getKey())
                .description(tag.getDescription())
                .color(tag.getColor())
                .values(machineTag.getValues() != null ? machineTag.getValues() : List.of())
                .organizationId(tag.getOrganizationId())
                .createdAt(machineTag.getTaggedAt())
                .build();
    }
}
