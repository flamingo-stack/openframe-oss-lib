package com.openframe.api.service.processor;

import com.openframe.data.document.device.Machine;

/**
 * Processor interface for device status operations in API service.
 * Provides hooks for processing device status updates.
 */
public interface DeviceStatusProcessor {

    // Called post-update so implementations can react to the new status without blocking the update itself
    void postProcessStatusUpdated(Machine machine);
}
