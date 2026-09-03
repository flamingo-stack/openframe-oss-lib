package com.openframe.data.document.device;

import java.util.EnumSet;
import java.util.Set;

public enum DeviceStatus {
    ACTIVE,
    PENDING,
    INACTIVE,
    MAINTENANCE,
    DECOMMISSIONED,
    ONLINE,
    OFFLINE,
    PENDING_DELETION,
    DELETED,
    ARCHIVED;

    public static final Set<DeviceStatus> INACTIVE_TARGETS = EnumSet.of(DELETED, PENDING_DELETION);
}
