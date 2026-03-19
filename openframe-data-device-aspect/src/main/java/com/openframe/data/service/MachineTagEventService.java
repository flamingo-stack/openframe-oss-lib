package com.openframe.data.service;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.MachineTag;
import com.openframe.data.document.tool.Tag;

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
     * Processes machineTag save event.
     * Fetches associated machine and tag data, then sends MachinePinotMessage.
     *
     * @param machineTag the machineTag entity that was saved
     */
    void processMachineTagSave(MachineTag machineTag);

    /**
     * Processes machineTag saveAll event.
     * Processes each machineTag in the collection and sends MachinePinotMessage for each affected machine.
     *
     * @param machineTags the collection of machineTag entities that were saved
     */
    void processMachineTagSaveAll(Iterable<MachineTag> machineTags);

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
     * Processes machineTag delete event for a single device.
     * Must be called BEFORE the delete so affected machineId can be resolved.
     * Re-syncs the machine to Pinot without the removed tag.
     *
     * @param machineId the machine from which the tag is being removed
     * @param tagId     the tag being removed
     */
    void processMachineTagDelete(String machineId, String tagId);

    /**
     * Processes bulk machineTag delete by tagId.
     * Must be called BEFORE the delete so affected machineIds can be resolved.
     * Re-syncs all affected machines to Pinot without the removed tag.
     *
     * @param tagId the tag being removed from all devices
     */
    void processMachineTagDeleteByTagId(String tagId);
}

