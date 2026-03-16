package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.DeviceTag;
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

    public TagService(TagRepository tagRepository, MachineTagRepository machineTagRepository) {
        this.tagRepository = tagRepository;
        this.machineTagRepository = machineTagRepository;
    }

    public List<Tag> listTags(String organizationId) {
        log.debug("Listing tags for org: {}", organizationId);
        return tagRepository.findByOrganizationId(organizationId);
    }

    /**
     * Search tag keys by prefix for autocomplete.
     * Returns tags whose key contains the search string (case-insensitive).
     */
    public List<Tag> searchTagKeys(String organizationId, String search) {
        log.debug("Searching tag keys for org: {}, search: {}", organizationId, search);
        if (search == null || search.isBlank()) {
            return tagRepository.findByOrganizationId(organizationId);
        }
        return tagRepository.findByOrganizationIdAndKeyContainingIgnoreCase(organizationId, search);
    }

    /**
     * Search tag values by prefix for autocomplete.
     * Returns values from the tag's predefined options that contain the search string (case-insensitive).
     */
    public List<String> searchTagValues(String organizationId, String tagKey, String search) {
        log.debug("Searching tag values for org: {}, key: {}, search: {}", organizationId, tagKey, search);
        Tag tag = tagRepository.findValuesByKeyAndOrganizationId(tagKey, organizationId);
        if (tag == null || tag.getValues() == null || tag.getValues().isEmpty()) {
            return List.of();
        }
        if (search == null || search.isBlank()) {
            return tag.getValues();
        }
        String lowerSearch = search.toLowerCase();
        return tag.getValues().stream()
                .filter(v -> v.toLowerCase().contains(lowerSearch))
                .toList();
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
     * Get enriched device tags for multiple machines (batch loading).
     * Returns DeviceTag objects that combine Tag metadata with MachineTag values.
     */
    public List<List<DeviceTag>> getDeviceTagsForMachines(List<String> machineIds) {
        log.debug("Getting device tags for {} machines", machineIds.size());

        if (machineIds.isEmpty()) {
            return new ArrayList<>();
        }

        List<MachineTag> allMachineTags = machineTagRepository.findByMachineIdIn(machineIds);

        if (allMachineTags.isEmpty()) {
            return machineIds.stream()
                    .map(id -> new ArrayList<DeviceTag>())
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
                            .map(mt -> buildDeviceTag(mt, tagsById.get(mt.getTagId())))
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList());
                })
                .collect(Collectors.toList());
    }

    /**
     * Get enriched device tags for a single machine.
     */
    public List<DeviceTag> getDeviceTagsForMachine(String machineId) {
        log.debug("Getting device tags for machine: {}", machineId);

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
                .map(mt -> buildDeviceTag(mt, tagsById.get(mt.getTagId())))
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    private DeviceTag buildDeviceTag(MachineTag machineTag, Tag tag) {
        if (tag == null) {
            log.warn("Tag not found for machineTag: {}", machineTag.getTagId());
            return null;
        }

        return DeviceTag.builder()
                .tagId(tag.getId())
                .key(tag.getKey())
                .description(tag.getDescription())
                .color(tag.getColor())
                .values(machineTag.getValues() != null ? machineTag.getValues() : List.of())
                .organizationId(tag.getOrganizationId())
                .createdAt(machineTag.getTaggedAt())
                .build();
    }
}
