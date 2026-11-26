package com.openframe.client.service.agentregistration;

import com.openframe.audit.AuditRecorder;
import com.openframe.client.dto.agent.AgentRegistrationTagInput;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditChange;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.document.tag.TagValidation;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.openframe.data.document.audit.AuditAction.TAG_CREATE;
import static com.openframe.data.document.audit.AuditAction.TAG_UPDATE;

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
    private final AuditRecorder auditRecorder;

    /**
     * Creates tags (if they don't exist) and assigns them to the newly registered device.
     *
     * @param machineId the registered machine's ID
     * @param tags      tags from the registration request
     * @return the keys of the tags that were assigned; a tag that failed its check or its save is left out
     */
    public List<String> assignTags(String machineId, List<AgentRegistrationTagInput> tags) {
        if (CollectionUtils.isEmpty(tags)) {
            return List.of();
        }

        Instant now = Instant.now();
        List<String> assigned = new ArrayList<>();

        for (AgentRegistrationTagInput tagInput : tags) {
            try {
                TagValidation.validateKey(tagInput.getKey());
                TagValidation.validateValues(tagInput.getValues(), tagInput.getKey());

                Tag tag = findOrCreateTag(tagInput.getKey(), tagInput.getValues(), now);

                TagAssignment assignment = TagAssignment.builder()
                        .entityId(machineId)
                        .tagId(tag.getId())
                        .entityType(TagEntityType.DEVICE)
                        .values(Objects.requireNonNullElse(tagInput.getValues(), List.of()))
                        .taggedAt(now)
                        .build();

                tagAssignmentRepository.save(assignment);
                assigned.add(tagInput.getKey());
                log.info("Assigned tag '{}' to machine {} during registration", tagInput.getKey(), machineId);
            } catch (IllegalArgumentException | DuplicateKeyException e) {
                log.warn("Tag '{}' not assigned to machine {} during registration: {}",
                        tagInput.getKey(), machineId, e.getMessage());
            } catch (Exception e) {
                log.error("Failed to assign tag '{}' to machine {} during registration",
                        tagInput.getKey(), machineId, e);
            }
        }
        return assigned;
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
                    List<String> valuesBefore = new ArrayList<>(existingValues);
                    existing.setValues(new ArrayList<>(merged));
                    tagRepository.save(existing);
                    log.info("Appended values {} to existing tag '{}' during registration", values, key);
                    auditRecorder.record(tagEventOf(TAG_UPDATE, existing)
                            .details(Map.of("entityType", TagEntityType.DEVICE))
                            .changes(Map.of("values", new AuditChange(valuesBefore, existing.getValues())))
                            .build());
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
        Map<String, Object> details = new HashMap<>();
        details.put("entityType", TagEntityType.DEVICE);
        details.put("key", key);
        details.put("values", saved.getValues());
        auditRecorder.record(tagEventOf(TAG_CREATE, saved).details(details).build());
        return saved;
    }

    private static AuditEntry.AuditEntryBuilder tagEventOf(AuditAction action, Tag tag) {
        return AuditEntry.builder()
                .action(action)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(tag.getId())
                .targetName(tag.getKey());
    }
}
