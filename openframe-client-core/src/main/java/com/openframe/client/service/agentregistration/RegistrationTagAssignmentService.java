package com.openframe.client.service.agentregistration;

import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.data.document.device.MachineTag;
import com.openframe.data.document.tool.Tag;
import com.openframe.data.repository.device.MachineTagRepository;
import com.openframe.data.repository.tool.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/**
 * Handles tag creation and assignment during agent registration.
 * For each tag in the registration request:
 *   1. Finds existing Tag by key+org, or creates a new CUSTOM tag
 *   2. Creates a MachineTag association (AOP aspect fires → Kafka → Pinot)
 *
 * Uses repositories directly (not TagService) because openframe-client-core
 * does not depend on openframe-api-lib.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RegistrationTagAssignmentService {

    private final TagRepository tagRepository;
    private final MachineTagRepository machineTagRepository;

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
            if (tagInput.getKey() == null || tagInput.getKey().isBlank()) {
                log.warn("Skipping tag with blank key during registration for machine: {}", machineId);
                continue;
            }

            try {
                Tag tag = findOrCreateTag(tagInput.getKey(), organizationId, tagInput.getValues(), now);

                MachineTag machineTag = MachineTag.builder()
                        .machineId(machineId)
                        .tagId(tag.getId())
                        .values(tagInput.getValues() != null ? tagInput.getValues() : List.of())
                        .taggedAt(now)
                        .taggedBy("registration")
                        .build();

                machineTagRepository.save(machineTag);
                log.info("Assigned tag '{}' to machine {} during registration", tagInput.getKey(), machineId);
            } catch (Exception e) {
                log.error("Failed to assign tag '{}' to machine {} during registration: {}",
                        tagInput.getKey(), machineId, e.getMessage(), e);
            }
        }
    }

    /**
     * Finds an existing tag by key and organization, or creates a new one.
     * If the tag already exists and new values are provided, appends any new values
     * to the tag's predefined options list (deduplicating).
     */
    private Tag findOrCreateTag(String key, String organizationId, List<String> values, Instant now) {
        Tag existing = tagRepository.findByKeyAndOrganizationId(key, organizationId);
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
                .organizationId(organizationId)
                .createdAt(now)
                .createdBy("registration")
                .build();

        Tag saved = tagRepository.save(tag);
        log.info("Created tag '{}' (id={}) during registration", key, saved.getId());
        return saved;
    }
}
