package com.openframe.client.service.rmm.osupdate;

public enum DeviceOsReportOutcome {
    APPLIED,
    IGNORED_OLDER,
    UNKNOWN_MACHINE,
    FROZEN_MACHINE,
    MALFORMED,
    FAILED
}
