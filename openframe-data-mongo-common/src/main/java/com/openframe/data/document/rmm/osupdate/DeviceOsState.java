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
