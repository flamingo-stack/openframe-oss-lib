package com.openframe.data.document.rmm.schedule;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "script_schedules_machines_assigned")
@CompoundIndex(
        name = "tenant_scriptScheduleId_machineId",
        def = "{'tenantId': 1, 'scriptScheduleId': 1, 'machineId': 1}",
        unique = true)
@CompoundIndex(name = "tenant_machineId", def = "{'tenantId': 1, 'machineId': 1}")
public class ScheduleScriptMachineAssigned implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String scriptScheduleId;

    private String machineId;

    private String createdBy;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
