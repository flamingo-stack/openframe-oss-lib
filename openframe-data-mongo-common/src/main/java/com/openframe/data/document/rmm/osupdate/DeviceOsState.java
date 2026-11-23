package com.openframe.data.document.rmm.osupdate;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "device_os_states")
@CompoundIndex(
        name = "tenant_machine",
        def = "{'tenantId': 1, 'machineId': 1}",
        unique = true)
public class DeviceOsState implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private OsPlatform platform;

    private String osVersion;

    private String osBuild;

    private String osProductName;

    private OsUpdateScanState scanState;

    private Instant lastScanAt;

    // Anything but CONFIRMED: the stored pending updates are from an earlier report, not from this one.
    private OsUpdateListConfidence pendingUpdatesConfidence;

    private OsPatchState patchState;

    private OsRebootPending rebootPending;

    private Instant rebootPendingSince;

    private OsUpdateManageability manageability;

    private OsUpdateAuthorization osUpdateAuthorization;

    private LastOsInstall lastOsInstall;

    private Map<String, Object> platformDetails;

    private Instant reportedAt;

    private Instant receivedAt;
}
