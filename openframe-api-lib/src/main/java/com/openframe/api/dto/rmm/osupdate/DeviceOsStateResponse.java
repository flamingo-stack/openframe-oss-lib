package com.openframe.api.dto.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagedElsewhereReason;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagementState;
import com.openframe.data.document.rmm.osupdate.OsUpdateObservedReason;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class DeviceOsStateResponse {

    private String osVersion;
    private String osBuild;
    private Boolean restartPending;
    private Instant restartPendingSince;
    private Instant lastScanAt;
    private String lastScanError;
    private Instant lastInstalledAt;
    private OsUpdateManagementState managementState;
    private OsUpdateManagedElsewhereReason managedElsewhereReason;
    private OsUpdateObservedReason observedReason;
    private OsUpdateAuthorization authorization;
    private Instant receivedAt;
}
