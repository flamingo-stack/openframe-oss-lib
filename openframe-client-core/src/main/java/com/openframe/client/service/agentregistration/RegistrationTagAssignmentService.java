package com.openframe.client.service.agentregistration;

import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.document.tag.TagValidation;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/**
 * Handles tag creation and assignment during agent registration.
 * Tags are tenant-wide and scoped by entity type (DEVICE here).
 * For each tag in the registration request:
 *   1. Finds existing Tag by key+entityType, or creates a new one with DEVICE entity type
 *   2. Creates a TagAssignment association with DEVICE entity type (AOP aspect fires → Kafka → Pinot)
 *
 * Uses repositories directly (not TagService) because openframe-client-core
 * does not depend on openframe-api-lib.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RegistrationTagAssignmentService {

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;

    /**
     * Creates tags (if they don't exist) and assigns them to the newly registered device.
     *
     * @param machineId the registered machine's ID
     * @param tags      tags from the registration request
     */
    public void assignTags(String machineId, List<AgentRegistrationTagInput> tags) {
        if (tags == null || tags.isEmpty()) {
            return;
        }

        Instant now = Instant.now();

        for (AgentRegistrationTagInput tagInput : tags) {
            try {
                TagValidation.validateKey(tagInput.getKey());
                TagValidation.validateValues(tagInput.getValues(), tagInput.getKey());

                Tag tag = findOrCreateTag(tagInput.getKey(), tagInput.getValues(), now);

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

    /**
     * Finds an existing tag by key and DEVICE entity type, or creates a new one.
     * If the tag already exists and new values are provided, appends any new values
     * to the tag's predefined options list (deduplicating).
     */
    private Tag findOrCreateTag(String key, List<String> values, Instant now) {
        Tag existing = tagRepository.findByKeyAndEntityType(key, TagEntityType.DEVICE);
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
                .createdAt(now)
                .build();

        Tag saved = tagRepository.save(tag);
        log.info("Created tag '{}' (id={}) with DEVICE entity type during registration", key, saved.getId());
        return saved;
    }
}
