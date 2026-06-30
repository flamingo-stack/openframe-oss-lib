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
 * Persisted record of a single ad-hoc command execution attempt — one machine's
 * slice of a batch command dispatch, one row in the Command Execution History.
 *
 * <p>Mirror of {@code ScriptExecution} for ad-hoc commands: a RUNNING row is
 * persisted per target machine at dispatch (shared {@code executionId}), and the
 * agent's result frame transitions it to SUCCESS / FAILED with stdout/stderr/exit
 * code written back in place — same lifecycle, same {@link ExecutionStatus}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "command_executions")
@CompoundIndex(
        name = "tenant_executionId_machineId_unique",
        def = "{'tenantId': 1, 'executionId': 1, 'machineId': 1}",
        unique = true
)
@CompoundIndex(
        name = "tenant_dispatchedAt",
        def = "{'tenantId': 1, 'dispatchedAt': -1}"
)
// Serves the watchdog sweep (status = RUNNING AND dispatchedAt < threshold).
@CompoundIndex(
        name = "status_dispatchedAt",
        def = "{'status': 1, 'dispatchedAt': 1}"
)
public class CommandExecution implements TenantScoped {

    /**
     * Maximum number of bytes of stdout / stderr persisted on the document.
     * Output larger than this is truncated and the corresponding
     * {@code *Truncated} flag is set; full output stays on the agent side.
     * Matches {@link ScriptExecution#MAX_OUTPUT_BYTES}.
     */
    public static final int MAX_OUTPUT_BYTES = 64 * 1024;

    @Id
    private String id;

    private String tenantId;

    @Indexed
    private String executionId;

    @Indexed
    private String machineId;

    /** The raw shell command dispatched to the agent. */
    private String command;

    private ScriptShell shell;

    private PrivilegeLevel privilegeLevel;

    private Integer timeoutSeconds;

    private String initiatedBy;

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
