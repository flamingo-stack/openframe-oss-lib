package com.openframe.data.service;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;

/**
 * Service interface for handling repository events and sending Kafka messages.
 * This service encapsulates all business logic for processing entity changes.
 */
public interface MachineTagEventService {

    /**
     * Processes machine save event.
     * Fetches all tags for the machine and sends MachinePinotMessage.
     *
     * @param machine the machine entity that was saved
     */
    void processMachineSave(Machine machine);

    /**
     * Processes machine saveAll event.
     * Processes each machine in the collection and sends MachinePinotMessage for each.
     *
     * @param machines the collection of machine entities that were saved
     */
    void processMachineSaveAll(Iterable<Machine> machines);

    /**
     * Processes tag assignment save event.
     * Fetches associated machine and tag data, then sends MachinePinotMessage.
     *
     * @param assignment the tag assignment entity that was saved
     */
    void processTagAssignmentSave(TagAssignment assignment);

    /**
     * Processes tag assignment saveAll event.
     * Processes each assignment in the collection and sends MachinePinotMessage for each affected machine.
     *
     * @param assignments the collection of tag assignment entities that were saved
     */
    void processTagAssignmentSaveAll(Iterable<TagAssignment> assignments);

    /**
     * Processes tag save event.
     * Only processes when tag key changes, fetches all affected machines.
     *
     * @param tag the tag entity that was saved
     */
    void processTagSave(Tag tag);

    /**
     * Processes tag saveAll event.
     * Processes each tag in the collection and sends MachinePinotMessage for affected machines.
     *
     * @param tags the collection of tag entities that were saved
     */
    void processTagSaveAll(Iterable<Tag> tags);

    /**
     * Processes tag assignment delete event for a single device.
     * Must be called BEFORE the delete so affected machineId can be resolved.
     * Re-syncs the machine to Pinot without the removed tag.
     *
     * @param machineId the machine from which the tag is being removed
     * @param tagId     the tag being removed
     */
    void processTagAssignmentDelete(String machineId, String tagId);

    /**
     * Processes bulk tag assignment delete by tagId.
     * Must be called BEFORE the delete so affected machineIds can be resolved.
     * Re-syncs all affected machines to Pinot without the removed tag.
     *
     * @param tagId the tag being removed from all devices
     */
    void processTagAssignmentDeleteByTagId(String tagId);
}
