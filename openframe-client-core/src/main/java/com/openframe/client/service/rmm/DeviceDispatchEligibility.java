package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.TelemetryStatus;

public final class DeviceDispatchEligibility {

    private DeviceDispatchEligibility() {
    }

    // D1: dispatch needs a managed device (status in CONNECTED) that is online right now (telemetryStatus).
    public static boolean isDispatchable(Machine machine) {
        return isManaged(machine) && machine.getTelemetryStatus() == TelemetryStatus.ONLINE;
    }

    public static boolean isManaged(Machine machine) {
        return machine != null && DeviceStatus.CONNECTED.contains(machine.getStatus());
    }
}
