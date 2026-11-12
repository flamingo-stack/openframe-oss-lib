package com.openframe.data.document.device;

import java.util.EnumSet;
import java.util.Set;

/**
 * Device lifecycle. Connectivity (online right now or not) is {@link TelemetryStatus} on
 * {@code Machine.telemetryStatus}, never a lifecycle value.
 */
public enum DeviceStatus {
    PENDING,
    MANAGED,
    PENDING_DELETION,
    DELETED,
    ARCHIVED;

    // "managed device": the agent and every required tool have connected at least once
    public static final Set<DeviceStatus> CONNECTED = EnumSet.of(MANAGED);
    // Heartbeats keep connectivity and lastSeen moving but never change these; an ARCHIVED device also stops taking
    // hostname, timezone and package-manager reports and only a reinstall brings it back, as PENDING.
    public static final Set<DeviceStatus> FROZEN = EnumSet.of(PENDING_DELETION, DELETED, ARCHIVED);

    public boolean isConnected() {
        return CONNECTED.contains(this);
    }
}
