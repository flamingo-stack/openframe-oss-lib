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
 * The set of machines a single {@link ScriptSchedule} targets — one document per
 * schedule, holding that schedule's id and its list of machine references (i.e.
 * "this schedule applies to these machines").
 *
 * <p>Tenant-scoped, mirroring {@link ScriptSchedule}: all queries must be scoped
 * by {@code tenantId}. Both id fields are references (not embedded): the schedule
 * by {@code ScriptSchedule.id} and machines by {@code Machine.machineId} (the
 * stable primary id, same convention as {@link ScriptExecution#getMachineId()}).
 *
 * <p>{@code (tenantId, scriptScheduleId)} is unique — it enforces the one-document-
 * per-schedule invariant the writer relies on and lets the schedule's machines be
 * fetched with a single-document lookup. {@code (tenantId, machineIds)} is a
 * multikey index for the reverse lookup — "which schedules target this machine".
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "script_schedules_machines_assigned")
@CompoundIndex(name = "tenant_scriptScheduleId", def = "{'tenantId': 1, 'scriptScheduleId': 1}", unique = true)
@CompoundIndex(name = "tenant_machineIds", def = "{'tenantId': 1, 'machineIds': 1}")
public class ScriptScheduleMachineAssigned implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String scriptScheduleId;

    private List<String> machineIds;

    private String createdBy;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
