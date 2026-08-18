package com.openframe.data.document.rmm;

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
@Document(collection = "machine_first_online_dispatch")
@CompoundIndex(
        name = "tenant_machineId_scheduleId",
        def = "{'tenantId': 1, 'machineId': 1, 'scheduleId': 1}",
        unique = true)
@CompoundIndex(
        name = "pending_by_first_seen",
        def = "{'status': 1, 'firstSeenAt': 1}")
public class DeviceFirstOnlineDispatch implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private String scheduleId;

    private Instant firstSeenAt;

    private Instant dispatchedAt;

    private DeviceOnlineDispatchStatus status;
}
