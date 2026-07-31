package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.mongodb.repository.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Repository for {@link ScheduleScriptExecution} header rows (one per schedule fire).
 * Per-(script, machine) leaf rows live in {@code ScriptExecutionRepository}.
 */
@Repository
public interface ScheduleScriptExecutionRepository
        extends MongoRepository<ScheduleScriptExecution, String>, CustomScheduleScriptExecutionRepository {

    Optional<ScheduleScriptExecution> findByTenantIdAndExecutionId(String tenantId, String executionId);

    Optional<ScheduleScriptExecution> findByTenantIdAndId(String tenantId, String id);

    /**
     * Header rows still in {@code status} whose fire was dispatched before {@code dispatchedAtBefore}.
     * Backs the schedule-header watchdog sweep (RUNNING headers older than the stuck-threshold),
     * mirroring {@code ScriptExecutionRepository.findByStatusAndDispatchedAtBefore} on the leaves.
     * Tenant-agnostic (each row carries its own tenantId).
     */
    List<ScheduleScriptExecution> findByStatusAndDispatchedAtBefore(ExecutionStatus status, Instant dispatchedAtBefore);

    @Query("{ 'tenantId': ?0, 'executionId': ?1, 'status': 'RUNNING' }")
    @Update("{ '$set': { 'status': ?2, 'finishedAt': ?3 } }")
    long transitionIfRunning(String tenantId, String executionId, ExecutionStatus finalStatus, Instant finishedAt);
}
