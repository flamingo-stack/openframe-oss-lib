package com.openframe.stream.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.repository.rmm.CustomScriptExecutionRepository.LeafStatusCounts;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Rolls up leaf {@link ScriptExecution} rows into the {@link ScheduleScriptExecution}
 * header for a single schedule fire, invoked from
 * {@link com.openframe.stream.handler.ScriptExecutionStatusUpdateHandler} after each leaf
 * transitions to a terminal status.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleScriptExecutionAggregator {

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;

    public void aggregate(String tenantId, String executionId) {
        if (tenantId == null || executionId == null) {
            return;
        }

        LeafStatusCounts counts = scriptExecutionRepository.countLeavesByStatus(tenantId, executionId);
        if (counts.running() > 0) {
            return;
        }

        ExecutionStatus finalStatus = counts.failed() > 0 ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS;
        long modified = scheduleScriptExecutionRepository.transitionIfRunning(
                tenantId, executionId, finalStatus, Instant.now());
        if (modified > 0) {
            log.info("Transitioned schedule fire header: executionId={} status=RUNNING→{} tenantId={}",
                    executionId, finalStatus, tenantId);
        }
    }
}
