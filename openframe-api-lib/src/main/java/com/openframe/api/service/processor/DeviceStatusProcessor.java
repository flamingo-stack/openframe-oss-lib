package com.openframe.api.service.processor;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;

/**
 * Processor interface for device status operations in API service.
 * Provides hooks for processing device status updates.
 */
public interface DeviceStatusProcessor {

    /**
     * Process after a device status has been updated.
     *
     * @param machine The machine with updated status
     */
    void postProcessStatusUpdated(Machine machine, DeviceStatus previousStatus);
}
