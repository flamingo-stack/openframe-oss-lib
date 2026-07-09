package com.openframe.data.document.rmm;

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
import java.util.List;

/**
 * Many-to-many assignment linking {@link ScriptSchedule}s to the machines they
 * target. Each document holds a set of schedule references and a set of machine
 * references — i.e. "these schedules apply to these machines".
 *
 * <p>Tenant-scoped, mirroring {@link ScriptSchedule}: all queries must be scoped
 * by {@code tenantId}. Both id lists are references (not embedded): schedules by
 * {@code ScriptSchedule.id} and machines by {@code Machine.machineId} (the stable
 * primary id, same convention as {@link ScriptExecution#getMachineId()}).
 *
 * <p>The {@code machineIds} and {@code scriptScheduleIds} arrays are indexed as
 * multikey compound indexes (with {@code tenantId}) so the assignment can be
 * looked up from either side — "which schedules target this machine" and "which
 * machines does this schedule target".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "script_schedules_machines_assigned")
@CompoundIndex(name = "tenant_scriptScheduleIds", def = "{'tenantId': 1, 'scriptScheduleIds': 1}")
@CompoundIndex(name = "tenant_machineIds", def = "{'tenantId': 1, 'machineIds': 1}")
public class ScriptScheduleMachineAssigned implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private List<String> scriptScheduleIds;

    private List<String> machineIds;

    private String createdBy;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
