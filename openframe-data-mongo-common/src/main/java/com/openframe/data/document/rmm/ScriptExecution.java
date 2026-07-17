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
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "script_executions")
@CompoundIndex(
        name = "tenant_executionId_machineId_scriptId_unique",
        def = "{'tenantId': 1, 'executionId': 1, 'machineId': 1, 'scriptId': 1}",
        unique = true
)
@CompoundIndex(
        name = "tenant_script_dispatchedAt",
        def = "{'tenantId': 1, 'scriptId': 1, 'dispatchedAt': -1}"
)
// Serves the watchdog sweep (status = RUNNING AND dispatchedAt < threshold).
@CompoundIndex(
        name = "status_dispatchedAt",
        def = "{'status': 1, 'dispatchedAt': 1}"
)
public class ScriptExecution implements TenantScoped {

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

    private String scheduleId;

    @Indexed
    private String machineId;

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
