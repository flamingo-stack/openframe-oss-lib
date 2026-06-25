package com.openframe.api.dto.execution;

import com.openframe.data.document.rmm.ScriptExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

/**
 * Read-side projection of an {@code Execution} row — the History list / detail
 * shape sent to the GraphQL layer.
 *
 * <p>{@code initiatedBy} stays a raw user id; the GraphQL {@code initiator} field
 * is resolved separately by the DataFetcher via the user DataLoader (mirrors the
 * {@code Script.author} pattern). Likewise the script's display name is not
 * carried here — the GraphQL {@code scriptName} field is resolved from
 * {@code scriptId} at read time via the script DataLoader.
 */
@Data
@Builder
public class ScriptExecutionResponse {

    private String id;
    private String executionId;
    private String scriptId;
    private String machineId;
    private PrivilegeLevel privilegeLevel;
    private String initiatedBy;
    private ScriptExecutionStatus status;

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
