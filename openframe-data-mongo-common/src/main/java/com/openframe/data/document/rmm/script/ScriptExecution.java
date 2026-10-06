package com.openframe.data.document.rmm.script;

import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

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

    // stdout/stderr above this is truncated (with the *Truncated flag set); keeps the doc well under Mongo's 16 MiB limit
    public static final int MAX_OUTPUT_BYTES = 64 * 1024;

    @Id
    private String id;

    private String tenantId;

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
    private ExecutionSource source;
    private PackageManagerType packageManager;
    private String packageName;
    private SoftwareAction softwareAction;
    private String softwareBundleId;
    private String softwareScheduleId;

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
