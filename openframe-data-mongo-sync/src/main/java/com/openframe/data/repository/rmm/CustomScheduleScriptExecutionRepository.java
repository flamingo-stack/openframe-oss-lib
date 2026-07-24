package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;

import java.time.Instant;

/**
 * Custom MongoTemplate-backed ops for {@link ScheduleScriptExecution} that don't fit the
 * derived-method mould. Implementation: {@code CustomScheduleScriptExecutionRepositoryImpl}.
 */
public interface CustomScheduleScriptExecutionRepository {

    boolean transitionIfRunning(String tenantId, String executionId, ExecutionStatus finalStatus, Instant finishedAt);
}
