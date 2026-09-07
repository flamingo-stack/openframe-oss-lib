package com.openframe.api.dto.rmm.software;

/**
 * Per-device software state — static (UP_TO_DATE / OUTDATED) or a lifecycle
 * transition triggered by a pending dispatch (SCHEDULED_UPDATE / UNINSTALLING /
 * SCHEDULED_UNINSTALL).
 */
public enum SoftwareOnDeviceStatus {
    UP_TO_DATE,
    OUTDATED,
    SCHEDULED_UPDATE,
    UNINSTALLING,
    SCHEDULED_UNINSTALL
}
