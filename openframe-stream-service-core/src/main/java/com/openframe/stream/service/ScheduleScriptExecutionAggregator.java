package com.openframe.stream.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.repository.rmm.CustomScriptExecutionRepository.LeafStatusTally;
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

    /**
     * Recompute the header status for the given fire after one of its leaves just
     * finished. Safe to call on every leaf transition (idempotent + short-circuits
     * when leaves are still running).
     */
    public void aggregate(String tenantId, String executionId) {
        if (tenantId == null || executionId == null) {
            return;
        }

        LeafStatusTally tally = scriptExecutionRepository.tallyByExecutionId(tenantId, executionId);
        if (tally.running() > 0) {
            return;
        }

        ExecutionStatus finalStatus = tally.failed() > 0 ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS;
        boolean transitioned = scheduleScriptExecutionRepository.transitionIfRunning(
                tenantId, executionId, finalStatus, Instant.now());
        if (transitioned) {
            log.info("Transitioned schedule fire header: executionId={} status=RUNNING→{} tenantId={}",
                    executionId, finalStatus, tenantId);
        }
    }
}
