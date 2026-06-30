package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.CommandExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

/**
 * Repository for {@link CommandExecution} batch-command history rows. Mirrors
 * {@code ScriptExecutionRepository}.
 */
@Repository
public interface CommandExecutionRepository extends MongoRepository<CommandExecution, String> {

    /** Tenant-scoped lookup by Mongo {@code _id} — backs Relay {@code node(id)} refetch. */
    Optional<CommandExecution> findByTenantIdAndId(String tenantId, String id);

    /** The per-machine row of a batch — used by the result write-back handler and getBatchResults. */
    Optional<CommandExecution> findByTenantIdAndExecutionIdAndMachineId(String tenantId, String executionId, String machineId);

    /** First row of an execution (any machine) — convenience for execution-level metadata. */
    Optional<CommandExecution> findFirstByTenantIdAndExecutionId(String tenantId, String executionId);

    /** Watchdog coarse pre-filter: RUNNING rows dispatched before a threshold. */
    java.util.List<CommandExecution> findByStatusAndDispatchedAtBefore(ExecutionStatus status, Instant dispatchedAtBefore);

    /**
     * Routing lookup used by {@code CommandResultDeserializer} BEFORE tenant
     * enrichment — hence no tenantId. {@code (machineId, executionId)} is
     * effectively unique within the {@code (tenantId, executionId, machineId)}
     * compound index.
     */
    Optional<CommandExecution> findByMachineIdAndExecutionId(String machineId, String executionId);

    /** All per-machine rows of one batch execution. */
    java.util.List<CommandExecution> findByExecutionId(String executionId);
}
