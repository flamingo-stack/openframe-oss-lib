package com.openframe.api.dto.rmm.software;

/** Fleet-wide freshness of a software title's most-installed version vs. the latest known. */
public enum SoftwareVersionStatus {
    UP_TO_DATE,
    OUTDATED,
    UNKNOWN
}
