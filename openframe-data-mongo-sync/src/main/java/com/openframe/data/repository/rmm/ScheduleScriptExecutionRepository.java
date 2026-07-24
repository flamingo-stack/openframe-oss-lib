package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

/**
 * Repository for {@link ScheduleScriptExecution} header rows (one per schedule fire).
 * Per-(script, machine) leaf rows live in {@code ScriptExecutionRepository}.
 */
@Repository
public interface ScheduleScriptExecutionRepository extends MongoRepository<ScheduleScriptExecution, String> {

    Optional<ScheduleScriptExecution> findByTenantIdAndExecutionId(String tenantId, String executionId);

    @Query("{ 'tenantId': ?0, 'executionId': ?1, 'status': 'RUNNING' }")
    @Update("{ '$set': { 'status': ?2, 'finishedAt': ?3 } }")
    long transitionIfRunning(String tenantId, String executionId, ExecutionStatus finalStatus, Instant finishedAt);
}
