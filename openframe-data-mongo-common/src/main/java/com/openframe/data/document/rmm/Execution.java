package com.openframe.data.document.rmm;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Persisted record of a single script-execution attempt — one row in the
 * Script Details → Execution History UI.
 *
 * <p>Lifecycle:
 * <ol>
 *   <li>Created with {@link ExecutionStatus#RUNNING} at NATS dispatch time.</li>
 *   <li>Transitioned to {@link ExecutionStatus#SUCCESS} or
 *       {@link ExecutionStatus#FAILING} when the agent's result frame arrives
 *       (or when the management watchdog notices a stuck row).</li>
 * </ol>
 *
 * <p>{@code scriptName} is captured as a <b>snapshot</b> at dispatch time —
 * the source script may later be renamed, archived, or soft-deleted, but the
 * history row must still display what was actually executed.
 *
 * <p>Batch dispatch fans out one {@code executionId} to N machines, persisting
 * one row per target. The unique key is therefore
 * {@code (tenantId, executionId, machineId)} — single-machine dispatch is the
 * degenerate batch-of-one case under the same constraint.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "rmm_executions")
@CompoundIndex(
        name = "tenant_executionId_machineId_unique",
        def = "{'tenantId': 1, 'executionId': 1, 'machineId': 1}",
        unique = true
)
@CompoundIndex(
        name = "tenant_script_dispatchedAt",
        def = "{'tenantId': 1, 'scriptId': 1, 'dispatchedAt': -1}"
)
public class Execution implements TenantScoped {

    /**
     * Maximum number of bytes of stdout / stderr persisted on the document.
     * Output larger than this is truncated and the corresponding
     * {@code *Truncated} flag is set; full output stays on the agent side.
     * 64 KiB is chosen as a balance — comfortably accommodates a typical
     * script run while staying well under Mongo's 16 MiB document ceiling
     * even when many fields accumulate.
     */
    public static final int MAX_OUTPUT_BYTES = 64 * 1024;

    @Id
    private String id;

    private String tenantId;

    /**
     * Correlation id minted server-side at dispatch — same value that goes to
     * the agent in {@code ScriptMessage.executionId} and comes back in
     * {@code RmmResultMessage.executionId}.
     */
    @Indexed
    private String executionId;

    @Indexed
    private String scriptId;

    /**
     * Snapshot of the script's name at dispatch time. Persisted on the row so
     * that History rows remain meaningful after the source script is renamed
     * or soft-deleted.
     */
    private String scriptName;

    @Indexed
    private String machineId;

    private PrivilegeLevel privilegeLevel;

    private String initiatedBy;

    @Indexed
    private ExecutionStatus status;

    private Instant dispatchedAt;
    private Instant statusChangedAt;
    private Instant finishedAt;
    private Integer exitCode;
    private Long executionTimeMs;
    private Boolean timedOut;
    private String stdout;
    private Boolean stdoutTruncated;
    private String stderr;
    private Boolean stderrTruncated;
    private String error;
}
