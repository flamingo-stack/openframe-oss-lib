package com.openframe.api.dto.execution;

import com.openframe.data.document.rmm.ExecutionStatus;
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
 * {@code Script.author} pattern).
 */
@Data
@Builder
public class ExecutionResponse {

    private String id;
    private String executionId;
    private String scriptId;
    private String scriptName;
    private String machineId;
    private PrivilegeLevel privilegeLevel;
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
