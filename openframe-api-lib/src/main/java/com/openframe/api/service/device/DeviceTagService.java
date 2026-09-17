package com.openframe.api.service.device;

import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagValidation;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import static com.openframe.data.document.tag.TagEntityType.DEVICE;

/**
 * Attaches and detaches DEVICE tags at runtime — the counterpart to
 * {@code RegistrationTagAssignmentService}, which does the same thing from the agent-registration
 * payload. Both write only Mongo ({@code tags} + {@code tag_assignments}); the Pinot facet columns
 * are refreshed by {@code MachineTagEventAspect}, which intercepts the repository calls made here
 * and republishes the machine's full tag list to Kafka.
 *
 * <p>Every write therefore has to go through an intercepted repository method — {@code save} or
 * {@code deleteByEntityIdAndTagIdAndEntityType}. Bypassing them (e.g. {@code deleteAll}) would
 * leave the device's Pinot row carrying tags it no longer has.
 *
 * <p>Not reused from the client-core service because {@code openframe-client-core} does not depend
 * on {@code openframe-api-lib}, and pulling the logic down into a shared module would drag the
 * machine/tag repositories along with it.
 */
@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeviceTagService {

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final MachineRepository machineRepository;

    /**
     * Tags a device with {@code key}, creating the tag key on first use.
     *
     * <p>Additive in both directions: new {@code values} are merged into the device's existing
     * assignment rather than replacing it, and into the tag's list of predefined options. Calling
     * it twice with the same key and values is a no-op beyond the Pinot republish.
     *
     * @return the tag, carrying this device's values (not the tag's full option list)
     */
    @Transactional
    public Tag assignTag(@NotBlank String machineId, @NotBlank String key, List<String> values) {
        TagValidation.validateKey(key);
        TagValidation.validateValues(values, key);
        requireMachine(machineId);

        Tag tag = findOrCreateTag(key, values);
        List<String> assignedValues = upsertAssignment(machineId, tag.getId(), values);

        log.info("Assigned tag '{}' to machine {} with values {}", key, machineId, assignedValues);
        return Tag.builder()
                .id(tag.getId())
                .key(tag.getKey())
                .description(tag.getDescription())
                .color(tag.getColor())
                .values(assignedValues)
                .entityType(tag.getEntityType())
                .createdAt(tag.getCreatedAt())
                .build();
    }

    /**
     * Detaches a tag from a device. The tag key itself survives — it stays available for other
     * devices and in the filter dropdowns; use {@code TagService.deleteTag} to drop the key
     * everywhere.
     *
     * @return {@code true} if the device had the tag, {@code false} if there was nothing to remove
     */
    @Transactional
    public boolean removeTag(@NotBlank String machineId, @NotBlank String tagId) {
        requireMachine(machineId);

        boolean assigned = tagAssignmentRepository
                .findByEntityIdAndTagIdAndEntityType(machineId, tagId, DEVICE)
                .isPresent();
        if (!assigned) {
            log.info("Tag {} is not assigned to machine {}, nothing to remove", tagId, machineId);
            return false;
        }

        // Aspect-intercepted: publishes the machine's remaining tags before the delete proceeds.
        tagAssignmentRepository.deleteByEntityIdAndTagIdAndEntityType(machineId, tagId, DEVICE);
        log.info("Removed tag {} from machine {}", tagId, machineId);
        return true;
    }

    private void requireMachine(String machineId) {
        if (machineRepository.findByMachineId(machineId).isEmpty()) {
            throw new DeviceNotFoundException("Device not found: " + machineId);
        }
    }

    /**
     * Finds the DEVICE tag for {@code key}, or creates it. On an existing tag any previously unseen
     * values are appended to its predefined options, so a value typed on one device becomes a
     * suggestion for the next.
     */
    private Tag findOrCreateTag(String key, List<String> values) {
        Tag existing = tagRepository.findByKeyAndEntityType(key, DEVICE);
        if (existing == null) {
            Tag created = tagRepository.save(Tag.builder()
                    .key(key)
                    .values(normalize(values))
                    .entityType(DEVICE)
                    .createdAt(Instant.now())
                    .build());
            log.info("Created DEVICE tag '{}' (id={})", key, created.getId());
            return created;
        }

        List<String> merged = merge(existing.getValues(), values);
        if (merged.size() != size(existing.getValues())) {
            existing.setValues(merged);
            // Aspect-intercepted: refreshes every device already carrying this tag.
            existing = tagRepository.save(existing);
            log.info("Appended values {} to existing tag '{}'", values, key);
        }
        return existing;
    }

    /**
     * Merges {@code values} into the device's assignment, creating it if the device does not carry
     * the tag yet. Saving through the repository is what triggers the Pinot republish.
     */
    private List<String> upsertAssignment(String machineId, String tagId, List<String> values) {
        Optional<TagAssignment> existing = tagAssignmentRepository
                .findByEntityIdAndTagIdAndEntityType(machineId, tagId, DEVICE);

        if (existing.isEmpty()) {
            TagAssignment saved = tagAssignmentRepository.save(TagAssignment.builder()
                    .entityId(machineId)
                    .tagId(tagId)
                    .entityType(DEVICE)
                    .values(normalize(values))
                    .taggedAt(Instant.now())
                    .build());
            return saved.getValues();
        }

        TagAssignment assignment = existing.get();
        List<String> merged = merge(assignment.getValues(), values);
        if (merged.size() != size(assignment.getValues())) {
            assignment.setValues(merged);
            return tagAssignmentRepository.save(assignment).getValues();
        }
        return assignment.getValues();
    }

    /** Insertion-ordered union — existing values keep their order, new ones are appended. */
    private static List<String> merge(List<String> current, List<String> added) {
        LinkedHashSet<String> merged = new LinkedHashSet<>(normalize(current));
        merged.addAll(normalize(added));
        return new ArrayList<>(merged);
    }

    private static List<String> normalize(List<String> values) {
        return values != null ? values : List.of();
    }

    private static int size(List<String> values) {
        return values != null ? values.size() : 0;
    }
}
