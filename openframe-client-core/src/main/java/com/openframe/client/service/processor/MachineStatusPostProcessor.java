package com.openframe.client.service.processor;

import com.openframe.data.document.device.DeviceStatus;

/**
 * Post-processor hook invoked after a machine status update is persisted.
 * The default implementation is a no-op; SaaS layers may provide specific behaviour.
 */
public interface MachineStatusPostProcessor {

    void onStatusUpdated(String machineId, DeviceStatus previousStatus, DeviceStatus newStatus);
}
