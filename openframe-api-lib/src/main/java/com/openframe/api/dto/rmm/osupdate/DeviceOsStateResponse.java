package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.LastOsInstall;
import com.openframe.data.document.rmm.osupdate.OsPatchState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateScanState;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class DeviceOsStateResponse {

    private OsPlatform platform;
    private String osVersion;
    private String osBuild;
    private String osProductName;
    private OsUpdateScanState scanState;
    private Instant lastScanAt;
    private OsUpdateListConfidence pendingUpdatesConfidence;
    private OsPatchState patchState;
    private OsRebootPending rebootPending;
    private Instant rebootPendingSince;
    private OsUpdateManageability manageability;
    private OsUpdateAuthorization osUpdateAuthorization;
    private LastOsInstall lastOsInstall;
    private Instant reportedAt;
    private Instant receivedAt;
}
