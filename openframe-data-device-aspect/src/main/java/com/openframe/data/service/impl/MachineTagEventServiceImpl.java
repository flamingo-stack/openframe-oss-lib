package com.openframe.data.service.impl;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.service.MachineTagEventService;
import com.openframe.kafka.model.MachinePinotMessage;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of RepositoryEventService that handles repository events and sends Kafka messages.
 * Contains all business logic for processing entity changes.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.device.aspect.enabled", havingValue = "true", matchIfMissing = true)
public class MachineTagEventServiceImpl implements MachineTagEventService {

    private final MachineRepository machineRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final TagRepository tagRepository;
    private final OssTenantRetryingKafkaProducer ossTenantKafkaProducer;

    @Value("${openframe.oss-tenant.kafka.topics.outbound.devices-topic}")
    private String machineEventsTopic;

    @Override
    public void processMachineSave(Machine machine) {
        try {
            log.info("Processing machine save event: {}", machine);
            sendMachineEventToKafka(machine);
            log.info("Machine event processed successfully");
        } catch (Exception e) {
            log.error("Error processing machine save event: {}", e.getMessage(), e);
        }
    }

    @Override
    public void processMachineSaveAll(Iterable<Machine> machines) {
        try {
            log.info("Processing machine saveAll event: {} machines", machines);
            for (Machine machine : machines) {
                sendMachineEventToKafka(machine);
            }
        } catch (Exception e) {
            log.error("Error in processMachineSaveAll: {}", e.getMessage(), e);
        }
    }

    @Override
    public void processTagAssignmentSave(TagAssignment assignment) {
        try {
            log.info("Processing tag assignment save event: {}", assignment);
            if (assignment.getEntityType() != TagEntityType.DEVICE) {
                log.debug("Skipping non-DEVICE tag assignment: {}", assignment.getEntityType());
                return;
            }
            sendTagAssignmentEventToKafka(assignment);
            log.info("Tag assignment event processed successfully for machine: {}", assignment.getEntityId());
        } catch (Exception e) {
            log.error("Error processing tag assignment save event: {}", e.getMessage(), e);
        }
    }

    @Override
    public void processTagAssignmentSaveAll(Iterable<TagAssignment> assignments) {
        try {
            log.info("Processing tag assignment saveAll event: {} assignments", assignments);

            // Group by entityId to avoid duplicate processing
            Set<String> processedEntityIds = new HashSet<>();

            for (TagAssignment assignment : assignments) {
                if (assignment.getEntityType() != TagEntityType.DEVICE) {
                    continue;
                }
                if (!processedEntityIds.contains(assignment.getEntityId())) {
                    sendTagAssignmentEventToKafka(assignment);
                    processedEntityIds.add(assignment.getEntityId());
                }
            }
        } catch (Exception e) {
            log.error("Error in processTagAssignmentSaveAll: {}", e.getMessage(), e);
        }
    }

    @Override
    public void processTagSave(Tag tag) {
        try {
            log.info("Processing tag save event: {}", tag);
            sendTagEventToKafka(tag);
            log.info("Tag event processed successfully");
        } catch (Exception e) {
            log.error("Error processing tag save event: {}", e.getMessage(), e);
        }
    }

    @Override
    public void processTagSaveAll(Iterable<Tag> tags) {
        try {
            log.info("Processing tag saveAll event: {} tags", tags);

            // Process each tag
            for (Tag tag : tags) {
                sendTagEventToKafka(tag);
            }
        } catch (Exception e) {
            log.error("Error in processTagSaveAll: {}", e.getMessage(), e);
        }
    }

    @Override
    public void processTagAssignmentDelete(String machineId, String tagId) {
        try {
            log.info("Processing tag assignment delete event: machineId={}, tagId={}", machineId, tagId);

            Machine machine = fetchMachine(machineId);
            if (machine == null) {
                log.warn("Machine not found for machineId: {}", machineId);
                return;
            }

            // Fetch current device tag assignments and exclude the one being removed
            List<TagAssignment> currentAssignments = tagAssignmentRepository
                    .findByEntityIdAndEntityType(machineId, TagEntityType.DEVICE);
            List<String> remainingTagIds = currentAssignments.stream()
                    .map(TagAssignment::getTagId)
                    .filter(id -> !id.equals(tagId))
                    .toList();

            List<Tag> remainingTags = remainingTagIds.isEmpty()
                    ? List.of()
                    : tagRepository.findAllById(remainingTagIds);

            // Build message excluding the removed tag's assignment
            List<TagAssignment> remainingAssignments = currentAssignments.stream()
                    .filter(a -> !a.getTagId().equals(tagId))
                    .toList();

            MachinePinotMessage message = buildMachinePinotMessageFromParts(machine, remainingTags, remainingAssignments);
            ossTenantKafkaProducer.publish(machineEventsTopic, machineId, message);

            log.info("Tag assignment delete event processed for machine: {}", machineId);
        } catch (Exception e) {
            log.error("Error processing tag assignment delete event: {}", e.getMessage(), e);
        }
    }

    @Override
    public void processTagAssignmentDeleteByTagId(String tagId) {
        try {
            log.info("Processing bulk tag assignment delete by tagId: {}", tagId);

            List<String> affectedMachineIds = fetchMachineIdsForTag(tagId);
            if (affectedMachineIds.isEmpty()) {
                log.info("No machines affected by tag deletion: {}", tagId);
                return;
            }

            for (String machineId : affectedMachineIds) {
                try {
                    Machine machine = fetchMachine(machineId);
                    if (machine == null) {
                        continue;
                    }

                    // Fetch current device tag assignments and exclude the one being deleted
                    List<TagAssignment> currentAssignments = tagAssignmentRepository
                            .findByEntityIdAndEntityType(machineId, TagEntityType.DEVICE);
                    List<String> remainingTagIds = currentAssignments.stream()
                            .map(TagAssignment::getTagId)
                            .filter(id -> !id.equals(tagId))
                            .toList();

                    List<Tag> remainingTags = remainingTagIds.isEmpty()
                            ? List.of()
                            : tagRepository.findAllById(remainingTagIds);

                    List<TagAssignment> remainingAssignments = currentAssignments.stream()
                            .filter(a -> !a.getTagId().equals(tagId))
                            .toList();

                    MachinePinotMessage message = buildMachinePinotMessageFromParts(machine, remainingTags, remainingAssignments);
                    ossTenantKafkaProducer.publish(machineEventsTopic, machineId, message);
                } catch (Exception e) {
                    log.error("Error processing machine {} for tag deletion: {}", machineId, e.getMessage());
                }
            }

            log.info("Bulk tag assignment delete processed for {} machines", affectedMachineIds.size());
        } catch (Exception e) {
            log.error("Error processing bulk tag assignment delete: {}", e.getMessage(), e);
        }
    }

    private void sendMachineEventToKafka(Machine machineEntity) {
        try {
            // Fetch all tags for the machine
            List<Tag> machineTags = fetchMachineTags(machineEntity.getMachineId());

            // Build MachinePinotMessage with complete data
            MachinePinotMessage message = buildMachinePinotMessage(machineEntity, machineTags);

            ossTenantKafkaProducer.publish(machineEventsTopic,  machineEntity.getMachineId(), message);
        } catch (Exception e) {
            log.error("Error sending machine event to Kafka for machine {}: {}",
                    machineEntity.getMachineId(), e.getMessage(), e);
        }
    }

    private void sendTagAssignmentEventToKafka(TagAssignment assignmentEntity) {
        // Fetch associated machine data
        Machine machine = fetchMachine(assignmentEntity.getEntityId());
        if (machine == null) {
            log.warn("Machine not found for machineId: {}", assignmentEntity.getEntityId());
            return;
        }

        // Fetch all tags for the machine (including the new one)
        List<Tag> machineTags = fetchMachineTags(machine.getMachineId());

        // Build MachinePinotMessage with updated tag list
        MachinePinotMessage message = buildMachinePinotMessage(machine, machineTags);

        // Send to Kafka asynchronously
        ossTenantKafkaProducer.publish(machineEventsTopic, machine.getMachineId(), message);
    }

    private void sendTagEventToKafka(Tag tagEntity) {
        // Check if this is an update operation and if key changed
        if (tagEntity.getId() != null) {

            // Fetch all machines with this tag
            List<String> machineIds = fetchMachineIdsForTag(tagEntity.getId());

            // Send MachinePinotMessage for each affected machine
            for (String machineId : machineIds) {
                try {
                    Machine machine = fetchMachine(machineId);
                    if (machine != null) {
                        List<Tag> machineTags = fetchMachineTags(machineId);
                        MachinePinotMessage message = buildMachinePinotMessage(machine, machineTags);

                        ossTenantKafkaProducer.publish(machineEventsTopic, machineId, message);
                        log.debug("Sent update for machine {} due to tag key change", machineId);
                    }
                } catch (Exception e) {
                    log.error("Error processing machine {} for tag key change: {}", machineId, e.getMessage());
                }
            }

            log.info("Processed tag key change for {} machines", machineIds.size());
        }
    }

    /**
     * Fetches all tags for a given machine ID.
     */
    private List<Tag> fetchMachineTags(String machineId) {
        List<TagAssignment> assignments = tagAssignmentRepository
                .findByEntityIdAndEntityType(machineId, TagEntityType.DEVICE);
        List<String> tagIds = assignments.stream()
                .map(TagAssignment::getTagId)
                .toList();
        return tagRepository.findAllById(tagIds);
    }

    /**
     * Fetches machine data by machineId.
     */
    private Machine fetchMachine(String machineId) {
        try {
            return machineRepository.findByMachineId(machineId).orElse(null);
        } catch (Exception e) {
            log.error("Error fetching machine with machineId {}: {}", machineId, e.getMessage(), e);
            return null;
        }
    }

    /**
     * Fetches all machine IDs that have a specific tag.
     */
    private List<String> fetchMachineIdsForTag(String tagId) {
        try {
            List<TagAssignment> assignments = tagAssignmentRepository
                    .findByTagIdAndEntityType(tagId, TagEntityType.DEVICE);

            return assignments.stream()
                    .map(TagAssignment::getEntityId)
                    .toList();
        } catch (Exception e) {
            log.error("Error fetching machine IDs for tag {}: {}", tagId, e.getMessage(), e);
            return List.of();
        }
    }

    /**
     * Builds MachinePinotMessage from Machine entity and its tags.
     * Fetches TagAssignment entries from DB to get per-device values.
     */
    private MachinePinotMessage buildMachinePinotMessage(Machine machine, List<Tag> tags) {
        List<TagAssignment> assignments = tagAssignmentRepository
                .findByEntityIdAndEntityType(machine.getMachineId(), TagEntityType.DEVICE);
        return buildMachinePinotMessageFromParts(machine, tags, assignments);
    }

    /**
     * Builds MachinePinotMessage from pre-resolved Machine, Tags, and TagAssignment entries.
     * Used by delete handlers where the TagAssignment list must exclude the tag being removed.
     */
    private MachinePinotMessage buildMachinePinotMessageFromParts(Machine machine, List<Tag> tags,
                                                                   List<TagAssignment> assignments) {
        Map<String, TagAssignment> assignmentByTagId = assignments.stream()
                .collect(Collectors.toMap(TagAssignment::getTagId, a -> a, (a, b) -> a));

        List<String> tagKeyNames = new ArrayList<>();
        List<String> tagKeyValues = new ArrayList<>();

        for (Tag tag : tags) {
            String key = tag.getKey();
            if (key != null) {
                tagKeyNames.add(key);
            }

            // Build key:value pairs for Pinot indexing
            TagAssignment assignment = assignmentByTagId.get(tag.getId());
            if (assignment != null && assignment.getValues() != null && !assignment.getValues().isEmpty()) {
                for (String value : assignment.getValues()) {
                    tagKeyValues.add(key + ":" + value);
                }
            }
        }

        return MachinePinotMessage.builder()
                .machineId(machine.getMachineId())
                .organizationId(machine.getOrganizationId())
                .deviceType(machine.getType() != null ? machine.getType().toString() : null)
                .status(machine.getStatus() != null ? machine.getStatus().toString() : null)
                .osType(machine.getOsType())
                .tags(tagKeyNames)
                .tagKeyValues(tagKeyValues)
                .ingestionTime(System.currentTimeMillis())
                .build();
    }
}
