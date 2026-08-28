package com.openframe.client.service.rmm.watchdog;

import com.openframe.client.metrics.ScriptExecutionWatchdogMetrics;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionWatchdogService {

    private static final String STUCK_ERROR_MESSAGE_FORMAT = "No result received within %d seconds; watchdog marked execution as failed";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleJobExecutionWatchdogService headerWatchdogService;
    private final ScriptExecutionWatchdogMetrics watchdogMetrics;

    @Value("${openframe.rmm.execution.watchdog.grace-seconds:120}")
    private long graceSeconds;

    @Value("${openframe.rmm.execution.watchdog.threshold-seconds:600}")
    private long fallbackThresholdSeconds;

    public void markStuckExecutionsAsFailed() {
        Instant now = Instant.now();

        List<ScriptExecution> stuck = findStuckRunning(now);
        if (stuck.isEmpty()) {
            log.debug("No stuck Execution rows found");
            return;
        }

        log.info("Found {} stuck Execution row(s) — transitioning to FAILED", stuck.size());
        stuck.forEach(row -> markFailing(row, now));
        scriptExecutionRepository.saveAll(stuck);
        watchdogMetrics.recordScriptReaped(stuck.size());
        log.info("Marked {} Execution row(s) as FAILED", stuck.size());

        headerWatchdogService.finalizeAffectedHeaders(stuck);
    }

    private List<ScriptExecution> findStuckRunning(Instant now) {
        long coarseFloorSeconds = Math.min(graceSeconds, fallbackThresholdSeconds);
        return scriptExecutionRepository
                .findByStatusAndDispatchedAtBefore(ExecutionStatus.RUNNING, now.minusSeconds(coarseFloorSeconds))
                .stream()
                .filter(row -> isStuck(row, now))
                .toList();
    }

    private void markFailing(ScriptExecution row, Instant now) {
        long thresholdSeconds = thresholdSecondsFor(row);
        row.setStatus(ExecutionStatus.FAILED);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setTimedOut(Boolean.TRUE);
        row.setError(STUCK_ERROR_MESSAGE_FORMAT.formatted(thresholdSeconds));
        log.info("Reaping stuck Execution: executionId={} machineId={} dispatchedAt={} thresholdSeconds={}",
                row.getExecutionId(), row.getMachineId(), row.getDispatchedAt(), thresholdSeconds);
    }

    private boolean isStuck(ScriptExecution row, Instant now) {
        return row.getDispatchedAt() != null && row.getDispatchedAt().isBefore(now.minusSeconds(thresholdSecondsFor(row)));
    }

    private long thresholdSecondsFor(ScriptExecution row) {
        Integer timeout = row.getTimeoutSeconds();
        return timeout != null ? timeout + graceSeconds : fallbackThresholdSeconds;
    }
}
