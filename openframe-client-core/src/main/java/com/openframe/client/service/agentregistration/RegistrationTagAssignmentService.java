package com.openframe.client.service.agentregistration;

import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Handles tag creation and assignment during agent registration.
 * For each tag in the registration request:
 *   1. Finds existing Tag by key+org, or creates a new CUSTOM tag with DEVICE entity type
 *   2. Creates a TagAssignment association with DEVICE entity type (AOP aspect fires → Kafka → Pinot)
 *
 * Uses repositories directly (not TagService) because openframe-client-core
 * does not depend on openframe-api-lib.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RegistrationTagAssignmentService {

    private static final Pattern TAG_PATTERN = Pattern.compile("^[a-zA-Z0-9_]+$");

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;

    /**
     * Creates tags (if they don't exist) and assigns them to the newly registered device.
     *
     * @param machineId      the registered machine's ID
     * @param organizationId the resolved organization ID
     * @param tags           tags from the registration request
     */
    public void assignTags(String machineId, String organizationId, List<AgentRegistrationTagInput> tags) {
        if (tags == null || tags.isEmpty()) {
            return;
        }

        Instant now = Instant.now();

        for (AgentRegistrationTagInput tagInput : tags) {
            try {
                validateTag(tagInput);
                Tag tag = findOrCreateTag(tagInput.getKey(), organizationId, tagInput.getValues(), now);

                TagAssignment assignment = TagAssignment.builder()
                        .entityId(machineId)
                        .tagId(tag.getId())
                        .entityType(TagEntityType.DEVICE)
                        .values(tagInput.getValues() != null ? tagInput.getValues() : List.of())
                        .taggedAt(now)
                        .build();

                tagAssignmentRepository.save(assignment);
                log.info("Assigned tag '{}' to machine {} during registration", tagInput.getKey(), machineId);
            } catch (Exception e) {
                log.error("Failed to assign tag '{}' to machine {} during registration: {}",
                        tagInput.getKey(), machineId, e.getMessage(), e);
            }
        }
    }

    private void validateTag(AgentRegistrationTagInput tagInput) {
        if (tagInput.getKey() == null || !TAG_PATTERN.matcher(tagInput.getKey()).matches()) {
            throw new IllegalArgumentException(
                    "Invalid tag key '%s': must contain only alphanumeric characters and underscores".formatted(tagInput.getKey()));
        }
        if (tagInput.getValues() != null) {
            for (String value : tagInput.getValues()) {
                if (value == null || !TAG_PATTERN.matcher(value).matches()) {
                    throw new IllegalArgumentException(
                            "Invalid tag value '%s' for key '%s': must contain only alphanumeric characters and underscores".formatted(value, tagInput.getKey()));
                }
            }
        }
    }

    /**
     * Finds an existing tag by key and organization, or creates a new one with DEVICE entity type.
     * If the tag already exists and new values are provided, appends any new values
     * to the tag's predefined options list (deduplicating).
     */
    private Tag findOrCreateTag(String key, String organizationId, List<String> values, Instant now) {
        Tag existing = tagRepository.findByKeyAndOrganizationIdAndEntityType(key, organizationId, TagEntityType.DEVICE);
        if (existing != null) {
            if (values != null && !values.isEmpty()) {
                List<String> existingValues = existing.getValues();
                if (existingValues == null) {
                    existingValues = new ArrayList<>();
                }
                HashSet<String> merged = new HashSet<>(existingValues);
                if (merged.addAll(values)) {
                    existing.setValues(new ArrayList<>(merged));
                    tagRepository.save(existing);
                    log.info("Appended values {} to existing tag '{}' during registration", values, key);
                }
            }
            return existing;
        }

        Tag tag = Tag.builder()
                .key(key)
                .values(values)
                .entityType(TagEntityType.DEVICE)
                .organizationId(organizationId)
                .createdAt(now)
                .build();

        Tag saved = tagRepository.save(tag);
        log.info("Created tag '{}' (id={}) with DEVICE entity type during registration", key, saved.getId());
        return saved;
    }
}
