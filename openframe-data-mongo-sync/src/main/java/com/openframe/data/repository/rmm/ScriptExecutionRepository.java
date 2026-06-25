package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptExecutionStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link ScriptExecution} rows in the History list.
 *
 * <p>Cursor-paged listing lives inline in {@code ExecutionService} via
 * {@code MongoTemplate} — the predicate is just {@code tenantId + scriptId},
 * not worth a Custom repository split.
 */
@Repository
public interface ScriptExecutionRepository extends MongoRepository<ScriptExecution, String> {

    Optional<ScriptExecution> findByTenantIdAndExecutionIdAndMachineId(String tenantId, String executionId, String machineId);

    Optional<ScriptExecution> findFirstByTenantIdAndExecutionId(String tenantId, String executionId);

    List<ScriptExecution> findByStatusAndDispatchedAtBefore(ScriptExecutionStatus status, Instant dispatchedAtBefore);
}
