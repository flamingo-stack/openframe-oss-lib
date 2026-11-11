package com.openframe.data.document.device;

import java.util.EnumSet;
import java.util.Set;

public enum DeviceStatus {
    PENDING,
    MANAGED,
    PENDING_DELETION,
    DELETED,
    ARCHIVED,
    // transitional until phase 3 of CU-86akb8vvf: ONLINE/OFFLINE are migrated to MANAGED, the rest are unused
    ACTIVE,
    INACTIVE,
    MAINTENANCE,
    DECOMMISSIONED,
    ONLINE,
    OFFLINE;

    // "managed device": ONLINE/OFFLINE stay until migration 031 has rewritten them to MANAGED
    public static final Set<DeviceStatus> CONNECTED = EnumSet.of(MANAGED, ONLINE, OFFLINE);
    // heartbeats keep connectivity moving but the lifecycle status never changes from these
    public static final Set<DeviceStatus> FROZEN = EnumSet.of(PENDING_DELETION, DELETED, ARCHIVED);

    public boolean isConnected() {
        return CONNECTED.contains(this);
    }
}
