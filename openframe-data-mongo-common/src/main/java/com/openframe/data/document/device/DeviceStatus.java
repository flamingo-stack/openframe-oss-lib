package com.openframe.data.document.device;

import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public enum DeviceStatus {
    PENDING,
    MANAGED,
    PENDING_DELETION,
    DELETED,
    ARCHIVED;

    public static final Set<DeviceStatus> CONNECTED = EnumSet.of(MANAGED);
    // Heartbeats keep connectivity and lastSeen moving but never change these; an ARCHIVED device also stops taking
    // hostname, timezone and package-manager reports and only a reinstall brings it back, as PENDING.
    public static final Set<DeviceStatus> FROZEN = EnumSet.of(PENDING_DELETION, DELETED, ARCHIVED);

    private static final Map<String, DeviceStatus> RETIRED_NAMES = Map.of(
            "ONLINE", MANAGED,
            "OFFLINE", MANAGED,
            "ACTIVE", MANAGED,
            "INACTIVE", ARCHIVED,
            "MAINTENANCE", ARCHIVED,
            "DECOMMISSIONED", ARCHIVED);

    public static DeviceStatus fromStored(String name) {
        return Optional.ofNullable(RETIRED_NAMES.get(name))
                .orElseGet(() -> valueOf(name));
    }

    public boolean isConnected() {
        return CONNECTED.contains(this);
    }
}
