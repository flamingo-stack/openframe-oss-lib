package com.openframe.api.service;

import com.openframe.api.dto.device.DeviceFilterOption;
import com.openframe.api.dto.device.DeviceTag;
import com.openframe.api.exception.TagAlreadyExistsException;
import com.openframe.api.exception.TagNotFoundException;
import com.openframe.data.document.device.MachineTag;
import com.openframe.data.document.tool.Tag;
import com.openframe.data.document.tool.TagType;
import com.openframe.data.repository.device.MachineTagRepository;
import com.openframe.data.repository.tool.TagRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Slf4j
@Transactional(readOnly = true)
public class TagService {

    private static final Pattern TAG_KEY_PATTERN = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$");
    private static final int TAG_VALUE_MAX_LENGTH = 200;
    private static final int TAG_DESCRIPTION_MAX_LENGTH = 500;

    private final TagRepository tagRepository;
    private final MachineTagRepository machineTagRepository;

    public TagService(TagRepository tagRepository, MachineTagRepository machineTagRepository) {
        this.tagRepository = tagRepository;
        this.machineTagRepository = machineTagRepository;
    }

    @Transactional
    public Tag createTag(String key, TagType type, String description, String color,
                         String organizationId, String createdBy, List<String> values) {
        log.info("Creating tag with key: {}, type: {}, org: {}", key, type, organizationId);

        validateTagKey(key);
        validateTagValues(values);
        validateDescription(description);

        try {
            if (tagRepository.existsByKeyAndOrganizationId(key, organizationId)) {
                throw new TagAlreadyExistsException(
                        "Tag with key '" + key + "' already exists in organization " + organizationId);
            }

            Tag tag = Tag.builder()
                    .key(key)
                    .type(type != null ? type : TagType.CUSTOM)
                    .description(description)
                    .color(color)
                    .values(values != null ? deduplicateValues(values) : null)
                    .organizationId(organizationId)
                    .createdAt(Instant.now())
                    .createdBy(createdBy)
                    .build();

            Tag saved = tagRepository.save(tag);
            log.info("Tag created successfully: id={}, key={}", saved.getId(), saved.getKey());
            return saved;
        } catch (DuplicateKeyException e) {
            // Race condition: another thread created the same tag between our check and save
            throw new TagAlreadyExistsException(
                    "Tag with key '" + key + "' already exists in organization " + organizationId);
        }
    }

    @Transactional
    public Tag updateTag(String tagId, String description, String color, TagType type,
                         List<String> values, String organizationId) {
        log.info("Updating tag: {}", tagId);

        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new TagNotFoundException("Tag not found: " + tagId));

        // Verify org ownership
        verifyTagOrgOwnership(tag, organizationId);

        if (description != null) {
            validateDescription(description);
            tag.setDescription(description);
        }
        if (color != null) {
            tag.setColor(color);
        }
        if (type != null) {
            tag.setType(type);
        }
        if (values != null) {
            validateTagValues(values);
            tag.setValues(deduplicateValues(values));
        }

        Tag saved = tagRepository.save(tag);
        log.info("Tag updated successfully: id={}", saved.getId());
        return saved;
    }

    @Transactional
    public void deleteTag(String tagId, String organizationId) {
        log.info("Deleting tag: {}", tagId);

        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new TagNotFoundException("Tag not found: " + tagId));

        // Verify org ownership
        verifyTagOrgOwnership(tag, organizationId);

        // Remove all machine-tag associations first
        machineTagRepository.deleteByTagId(tagId);
        tagRepository.deleteById(tagId);

        log.info("Tag deleted successfully: {}", tagId);
    }

    public List<Tag> listTags(String organizationId, List<TagType> types) {
        log.debug("Listing tags for org: {}, types: {}", organizationId, types);

        if (types != null && !types.isEmpty()) {
            return tagRepository.findByOrganizationIdAndTypeIn(organizationId, types);
        }
        return tagRepository.findByOrganizationId(organizationId);
    }

    public Optional<Tag> findTagById(String tagId) {
        return tagRepository.findById(tagId);
    }

    /**
     * Find an existing tag by key within an organization, or create a new CUSTOM tag if not found.
     */
    private Tag findOrCreateTag(String key, String organizationId, String createdBy) {
        log.debug("Finding or creating tag with key: {}, org: {}", key, organizationId);

        Tag existing = tagRepository.findByKeyAndOrganizationId(key, organizationId);
        if (existing != null) {
            return existing;
        }

        return createTag(key, TagType.CUSTOM, null, null, organizationId, createdBy, null);
    }

    /**
     * Resolve a tag identifier to a tagId. Accepts either a tagId or a key.
     * If key is provided and no matching tag exists, it will be auto-created as CUSTOM.
     *
     * @param tagId          tag definition ID (optional if key is provided)
     * @param key            tag key name (optional if tagId is provided)
     * @param organizationId organization context for key-based lookup/creation
     * @param createdBy      user ID for tag auto-creation
     * @return resolved tag ID
     * @throws IllegalArgumentException if neither tagId nor key is provided
     * @throws TagNotFoundException     if tagId is provided but not found
     */
    @Transactional
    public String resolveTagId(String tagId, String key, String organizationId, String createdBy) {
        if (tagId != null && !tagId.isBlank()) {
            if (!tagRepository.existsById(tagId)) {
                throw new TagNotFoundException("Tag not found: " + tagId);
            }
            return tagId;
        }
        if (key != null && !key.isBlank()) {
            Tag tag = findOrCreateTag(key, organizationId, createdBy);
            return tag.getId();
        }
        throw new IllegalArgumentException("Either tagId or key must be provided");
    }

    /**
     * Get all distinct values for a specific tag key with device counts.
     * Used to populate the "Select Tag Value" dropdown in the filter UI.
     *
     * @param tagKey the tag key name (e.g., "site")
     * @return list of value options with counts, sorted alphabetically
     */
    public List<DeviceFilterOption> getTagValueOptions(String tagKey) {
        log.debug("Getting tag value options for key: {}", tagKey);

        // 1. Find all tags with this key (across all organizations)
        List<Tag> tags = tagRepository.findByKeyIn(List.of(tagKey));
        if (tags.isEmpty()) {
            return List.of();
        }

        List<String> tagIds = tags.stream().map(Tag::getId).toList();

        // 2. Get all machine-tag associations for these tag IDs
        List<MachineTag> machineTags = machineTagRepository.findByTagIdIn(tagIds);

        // 3. Flatten all values and count how many devices have each value
        Map<String, Integer> valueCounts = new LinkedHashMap<>();
        for (MachineTag mt : machineTags) {
            if (mt.getValues() != null) {
                for (String value : mt.getValues()) {
                    valueCounts.merge(value, 1, Integer::sum);
                }
            }
        }

        // 4. Convert to sorted filter options
        return valueCounts.entrySet().stream()
                .map(entry -> DeviceFilterOption.builder()
                        .value(entry.getKey())
                        .label(entry.getKey())
                        .count(entry.getValue())
                        .build())
                .sorted(Comparator.comparing(DeviceFilterOption::getValue))
                .toList();
    }

    @Transactional
    public MachineTag assignTagToDevice(String machineId, String tagId, List<String> values,
                                         String createdBy, String deviceOrganizationId) {
        log.info("Assigning tag {} to device {} with values: {}", tagId, machineId, values);

        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new TagNotFoundException("Tag not found: " + tagId));

        // Verify tag belongs to the same organization as the device
        if (deviceOrganizationId != null && !tag.getOrganizationId().equals(deviceOrganizationId)) {
            throw new IllegalArgumentException(
                    "Tag '" + tag.getKey() + "' does not belong to the device's organization");
        }

        validateTagValues(values);
        List<String> normalizedValues = values != null ? deduplicateValues(values) : List.of();

        // Upsert: update values if already assigned, otherwise create new association
        Optional<MachineTag> existing = machineTagRepository.findByMachineIdAndTagId(machineId, tagId);
        if (existing.isPresent()) {
            log.info("Tag {} already assigned to device {}, updating values", tagId, machineId);
            MachineTag machineTag = existing.get();
            machineTag.setValues(normalizedValues);
            machineTag.setTaggedAt(Instant.now());
            machineTag.setTaggedBy(createdBy);
            MachineTag saved = machineTagRepository.save(machineTag);
            log.info("Tag assignment updated: machineTag.id={}", saved.getId());
            return saved;
        }

        MachineTag machineTag = MachineTag.builder()
                .machineId(machineId)
                .tagId(tagId)
                .values(normalizedValues)
                .taggedAt(Instant.now())
                .taggedBy(createdBy)
                .build();

        MachineTag saved = machineTagRepository.save(machineTag);
        log.info("Tag assigned successfully: machineTag.id={}", saved.getId());
        return saved;
    }

    @Transactional
    public MachineTag updateDeviceTagValues(String machineId, String tagId, List<String> values) {
        log.info("Updating tag {} values on device {}: {}", tagId, machineId, values);

        validateTagValues(values);

        List<MachineTag> machineTags = machineTagRepository.findByMachineId(machineId);
        MachineTag machineTag = machineTags.stream()
                .filter(mt -> mt.getTagId().equals(tagId))
                .findFirst()
                .orElseThrow(() -> new TagNotFoundException(
                        "Tag " + tagId + " not assigned to device " + machineId));

        machineTag.setValues(values != null ? deduplicateValues(values) : List.of());
        MachineTag saved = machineTagRepository.save(machineTag);
        log.info("Device tag values updated: machineTag.id={}", saved.getId());
        return saved;
    }

    @Transactional
    public void removeTagFromDevice(String machineId, String tagId) {
        log.info("Removing tag {} from device {}", tagId, machineId);
        machineTagRepository.deleteByMachineIdAndTagId(machineId, tagId);
        log.info("Tag removed from device successfully");
    }

    @Transactional
    public List<MachineTag> bulkAssignTag(List<String> machineIds, String tagId,
                                           List<String> values, String createdBy,
                                           String organizationId) {
        log.info("Bulk assigning tag {} to {} devices with values: {}", tagId, machineIds.size(), values);

        Tag tag = tagRepository.findById(tagId)
                .orElseThrow(() -> new TagNotFoundException("Tag not found: " + tagId));

        // Verify tag belongs to the specified organization
        if (organizationId != null && !tag.getOrganizationId().equals(organizationId)) {
            throw new IllegalArgumentException(
                    "Tag '" + tag.getKey() + "' does not belong to the specified organization");
        }

        validateTagValues(values);

        Instant now = Instant.now();
        List<String> normalizedValues = values != null ? deduplicateValues(values) : List.of();

        // Load existing associations in one query to determine upsert vs insert
        List<MachineTag> existingAssociations = machineTagRepository
                .findByMachineIdInAndTagIdIn(machineIds, List.of(tagId));
        Map<String, MachineTag> existingByMachineId = existingAssociations.stream()
                .collect(Collectors.toMap(MachineTag::getMachineId, mt -> mt, (a, b) -> a));

        List<MachineTag> toSave = machineIds.stream()
                .map(machineId -> {
                    MachineTag existing = existingByMachineId.get(machineId);
                    if (existing != null) {
                        // Update existing association
                        existing.setValues(normalizedValues);
                        existing.setTaggedAt(now);
                        existing.setTaggedBy(createdBy);
                        return existing;
                    }
                    // Create new association
                    return MachineTag.builder()
                            .machineId(machineId)
                            .tagId(tagId)
                            .values(normalizedValues)
                            .taggedAt(now)
                            .taggedBy(createdBy)
                            .build();
                })
                .toList();

        List<MachineTag> saved = machineTagRepository.saveAll(toSave);
        log.info("Bulk tag assignment completed: {} devices tagged ({} updated, {} created)",
                saved.size(), existingAssociations.size(), saved.size() - existingAssociations.size());
        return saved;
    }

    @Transactional
    public void bulkRemoveTag(List<String> machineIds, String tagId) {
        log.info("Bulk removing tag {} from {} devices", tagId, machineIds.size());

        for (String machineId : machineIds) {
            machineTagRepository.deleteByMachineIdAndTagId(machineId, tagId);
        }

        log.info("Bulk tag removal completed");
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

        // Bulk load all machine-tag associations
        List<MachineTag> allMachineTags = machineTagRepository.findByMachineIdIn(machineIds);

        if (allMachineTags.isEmpty()) {
            return machineIds.stream()
                    .map(id -> new ArrayList<DeviceTag>())
                    .collect(Collectors.toList());
        }

        // Group machine tags by machineId
        Map<String, List<MachineTag>> machineTagsByMachineId = allMachineTags.stream()
                .collect(Collectors.groupingBy(MachineTag::getMachineId));

        // Bulk load all tag definitions
        Set<String> allTagIds = allMachineTags.stream()
                .map(MachineTag::getTagId)
                .collect(Collectors.toSet());
        List<Tag> allTags = tagRepository.findAllById(new ArrayList<>(allTagIds));
        Map<String, Tag> tagsById = allTags.stream()
                .collect(Collectors.toMap(Tag::getId, tag -> tag));

        // Build DeviceTag objects for each machine
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
                .type(tag.getType())
                .description(tag.getDescription())
                .color(tag.getColor())
                .values(machineTag.getValues() != null ? machineTag.getValues() : List.of())
                .organizationId(tag.getOrganizationId())
                .createdAt(machineTag.getTaggedAt())
                .createdBy(machineTag.getTaggedBy())
                .build();
    }

    // --- Validation helpers ---

    /**
     * Validates tag key format: alphanumeric, underscore, hyphen only.
     * Must start with alphanumeric. Max 100 characters.
     * Colons are explicitly forbidden to prevent breaking tagKeyValues compound encoding in Pinot.
     */
    private void validateTagKey(String key) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Tag key must not be blank");
        }
        if (!TAG_KEY_PATTERN.matcher(key).matches()) {
            throw new IllegalArgumentException(
                    "Tag key must contain only letters, digits, underscores, and hyphens, "
                            + "start with a letter or digit, and be at most 100 characters. Got: '" + key + "'");
        }
    }

    /**
     * Validates tag values: no empty/blank values, no colons, max length enforced.
     */
    private void validateTagValues(List<String> values) {
        if (values == null) {
            return;
        }
        for (String value : values) {
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException("Tag values must not contain blank entries");
            }
            if (value.contains(":")) {
                throw new IllegalArgumentException(
                        "Tag values must not contain colons (used as separator in Pinot indexing). Got: '" + value + "'");
            }
            if (value.length() > TAG_VALUE_MAX_LENGTH) {
                throw new IllegalArgumentException(
                        "Tag value must not exceed " + TAG_VALUE_MAX_LENGTH + " characters. Got: " + value.length());
            }
        }
    }

    private void validateDescription(String description) {
        if (description != null && description.length() > TAG_DESCRIPTION_MAX_LENGTH) {
            throw new IllegalArgumentException(
                    "Tag description must not exceed " + TAG_DESCRIPTION_MAX_LENGTH + " characters");
        }
    }

    /**
     * Verifies that the tag belongs to the specified organization.
     */
    private void verifyTagOrgOwnership(Tag tag, String organizationId) {
        if (organizationId != null && !tag.getOrganizationId().equals(organizationId)) {
            throw new IllegalArgumentException(
                    "Tag '" + tag.getKey() + "' does not belong to organization " + organizationId);
        }
    }

    /**
     * Removes duplicate values while preserving order.
     */
    private List<String> deduplicateValues(List<String> values) {
        return new ArrayList<>(new LinkedHashSet<>(values));
    }
}