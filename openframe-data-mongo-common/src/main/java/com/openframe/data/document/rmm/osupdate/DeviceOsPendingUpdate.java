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
@Document(collection = "device_os_pending_updates")
@CompoundIndex(
        name = "tenant_machine_identifier",
        def = "{'tenantId': 1, 'machineId': 1, 'identifier': 1}",
        unique = true)
public class DeviceOsPendingUpdate implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private OsPlatform platform;

    private String identifier;

    // Starts the deadline of this device and update. Set by the first report that names the update, never moved.
    private Instant discoveredAt;

    private Boolean downloaded;

    private MacosUpdatePresence macosPresence;
}
