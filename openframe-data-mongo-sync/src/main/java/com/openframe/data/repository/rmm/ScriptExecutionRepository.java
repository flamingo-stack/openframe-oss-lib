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
 * <p>Cursor-paged listing lives on {@link CustomScriptExecutionRepository}
 * (MongoTemplate-backed), keeping all {@code Criteria}/cursor/sort assembly in
 * the data layer — same split as {@code ScriptRepository}.
 */
@Repository
public interface ScriptExecutionRepository
        extends MongoRepository<ScriptExecution, String>, CustomScriptExecutionRepository {

    Optional<ScriptExecution> findByTenantIdAndExecutionIdAndMachineId(String tenantId, String executionId, String machineId);

    Optional<ScriptExecution> findFirstByTenantIdAndExecutionId(String tenantId, String executionId);

    List<ScriptExecution> findByStatusAndDispatchedAtBefore(ScriptExecutionStatus status, Instant dispatchedAtBefore);
}
