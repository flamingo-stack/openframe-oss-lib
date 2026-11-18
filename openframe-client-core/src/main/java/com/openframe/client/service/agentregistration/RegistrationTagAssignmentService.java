package com.openframe.client.service.agentregistration;

import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.document.tag.TagValidation;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
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

    private final RegistrationTagResolver tagResolver;
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

                String key = tagInput.getKey();
                List<String> values = tagInput.getValues();
                Tag tag = tagResolver.resolve(key, values, now);

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
}
