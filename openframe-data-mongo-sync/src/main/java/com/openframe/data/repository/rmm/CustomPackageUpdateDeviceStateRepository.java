package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.software.SoftwareActionStatus;

public interface CustomPackageUpdateDeviceStateRepository {

    // Moves the state from IN_PROGRESS to status in one conditional write; false when it is not IN_PROGRESS (any more).
    boolean finishInProgress(String tenantId, String requestId, String machineId, SoftwareActionStatus status,
                             String failedMessage);
}
