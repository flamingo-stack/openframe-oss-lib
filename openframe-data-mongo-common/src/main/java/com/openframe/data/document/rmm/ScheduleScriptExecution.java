package com.openframe.data.document.rmm;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

/**
 * Header record for a single {@link ScriptSchedule} fire — one document per run,
 * regardless of how many scripts × machines the run fans out to. Ties together
 * the per-(script, machine) leaf {@link ScriptExecution} rows produced by the
 * same fire via a shared {@link #executionId}.
 *
 * <p>Lifecycle:
 * <ol>
 *   <li>Persisted with {@link ExecutionStatus#RUNNING} at dispatch time (before
 *       NATS publish), alongside a snapshot of the scripts / machines it
 *       targeted.</li>
 *   <li>Transitions to {@code SUCCESS} or {@code FAILED} once every leaf
 *       {@code ScriptExecution} sharing its {@code executionId} is terminal —
 *       the aggregator is TODO (waits for stream-service work to be in scope).</li>
 * </ol>
 *
 * <p>{@code scriptIds} and {@code machineIds} are snapshots at dispatch time:
 * they must keep displaying what was actually attempted even if the schedule
 * is later edited or the target set changes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "schedule_script_execution")
@CompoundIndex(
        name = "tenant_executionId_unique",
        def = "{'tenantId': 1, 'executionId': 1}",
        unique = true
)
@CompoundIndex(
        name = "tenant_schedule_dispatchedAt",
        def = "{'tenantId': 1, 'scheduleId': 1, 'dispatchedAt': -1}"
)
public class ScheduleScriptExecution implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    /** Correlation id shared with every leaf {@link ScriptExecution} row this fire produced. */
    @Indexed
    private String executionId;

    @Indexed
    private String scheduleId;

    private String initiatedBy;

    /** Snapshot at fire time — the scripts that were runnable when the schedule fired. */
    private List<String> scriptIds;

    /** Snapshot at fire time — the machines the schedule was fanned out to. */
    private List<String> machineIds;

    @Indexed
    private ExecutionStatus status;

    private Instant dispatchedAt;
    private Instant finishedAt;

    @CreatedDate
    private Instant createdAt;
}
