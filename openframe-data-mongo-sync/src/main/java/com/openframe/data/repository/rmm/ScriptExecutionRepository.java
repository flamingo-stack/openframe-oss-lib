package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScriptExecutionRepository
        extends MongoRepository<ScriptExecution, String>, CustomScriptExecutionRepository {

    Optional<ScriptExecution> findByTenantIdAndId(String tenantId, String id);

    Optional<ScriptExecution> findByTenantIdAndExecutionIdAndMachineId(String tenantId, String executionId, String machineId);

    Optional<ScriptExecution> findByMachineIdAndExecutionId(String machineId, String executionId);

    Optional<ScriptExecution> findFirstByTenantIdAndExecutionId(String tenantId, String executionId);

    List<ScriptExecution> findByTenantIdAndExecutionId(String tenantId, String executionId);

    List<ScriptExecution> findByStatusAndDispatchedAtBefore(ExecutionStatus status, Instant dispatchedAtBefore);

    Optional<ScriptExecution> findFirstByTenantIdAndMachineIdAndScriptIdAndSourceOrderByDispatchedAtDesc(
            String tenantId, String machineId, String scriptId, ExecutionSource source);
}
