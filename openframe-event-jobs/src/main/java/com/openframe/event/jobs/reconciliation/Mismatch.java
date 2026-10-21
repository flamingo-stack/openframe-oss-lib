package com.openframe.event.jobs.reconciliation;

import lombok.AllArgsConstructor;
import lombok.Getter;

// One target row whose copy differs from its source, or whose source no longer exists.
@Getter
@AllArgsConstructor
class Mismatch {

    private final String tenantId;
    private final String id;
    private final boolean missingSource;
}
