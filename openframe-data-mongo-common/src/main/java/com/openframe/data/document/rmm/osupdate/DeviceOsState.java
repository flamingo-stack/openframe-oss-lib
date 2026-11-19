package com.openframe.data.document.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceOsState {

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
