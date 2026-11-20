package com.openframe.data.document.rmm.software;

import java.util.List;

public enum SoftwareActionStatus {

    SCHEDULED,
    IN_PROGRESS,
    WAITING,
    COMPLETED,
    FAILED;

    public static final List<SoftwareActionStatus> SORT_ORDER = List.of(FAILED, WAITING, IN_PROGRESS, SCHEDULED, COMPLETED);

    public int sortRank() {
        return SORT_ORDER.indexOf(this);
    }
}
