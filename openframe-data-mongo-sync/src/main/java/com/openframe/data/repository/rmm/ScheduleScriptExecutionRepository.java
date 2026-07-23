package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScheduleScriptExecution;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for {@link ScheduleScriptExecution} header rows (one per schedule fire).
 * Per-(script, machine) leaf rows live in {@code ScriptExecutionRepository}.
 */
@Repository
public interface ScheduleScriptExecutionRepository extends MongoRepository<ScheduleScriptExecution, String> {

    Optional<ScheduleScriptExecution> findByTenantIdAndExecutionId(String tenantId, String executionId);
}
