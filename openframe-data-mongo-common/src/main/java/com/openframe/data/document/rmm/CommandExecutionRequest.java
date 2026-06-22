package com.openframe.data.document.rmm;

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

/**
 * One agent's slice of a batch command dispatch ({@code batchRunCommand}): a
 * single ({@link #machineId}, {@link #executionId}) execution. A batch fanned
 * out to N machines produces N of these rows — all sharing one server-minted
 * {@link #executionId}, one row per target.
 *
 * <p>The rows are created with status {@link CommandExecutionStatus#PENDING}
 * <i>before</i> the command is published over NATS, so a dispatch is never
 * "in flight" without a durable record. Each row flips to
 * {@link CommandExecutionStatus#EXECUTED} independently once that machine's
 * asynchronous result has arrived (handled separately) — which is why the
 * grain is per-machine rather than per-batch.
 *
 * <p>The {@code (machineId, executionId)} pair is unique: a given machine can
 * appear at most once under a given execution. {@code executionId} is a global
 * UUID, so the pair is unique on its own.
 *
 * <p>Not {@code TenantScoped}: this lives in a tenant's own physical database
 * (DB-per-tenant), so the row is already implicitly tenant-isolated and carries
 * no {@code tenantId} field.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "command_execution_requests")
@CompoundIndex(
        def = "{'machineId': 1, 'executionId': 1}",
        unique = true
)
public class CommandExecutionRequest {

    @Id
    private String id;

    private String executionId;

    private String machineId;

    private String command;

    private ScriptShell shell;

    private PrivilegeLevel privilegeLevel;

    private Integer timeoutSeconds;

    /**
     * Lifecycle status. The row is born {@link CommandExecutionStatus#PENDING}
     * (before publish) and flips to {@link CommandExecutionStatus#EXECUTED}
     * once this machine's result is in.
     */
    @Builder.Default
    private CommandExecutionStatus status = CommandExecutionStatus.PENDING;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
