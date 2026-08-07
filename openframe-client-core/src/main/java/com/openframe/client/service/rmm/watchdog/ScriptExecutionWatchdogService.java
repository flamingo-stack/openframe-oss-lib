package com.openframe.client.service.rmm.watchdog;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionWatchdogService {

    private static final String STUCK_ERROR_MESSAGE_FORMAT = "No result received within %d seconds; watchdog marked execution as failed";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleJobExecutionWatchdogService headerWatchdogService;

    @Value("${openframe.rmm.execution.watchdog.grace-seconds:120}")
    private long graceSeconds;

    @Value("${openframe.rmm.execution.watchdog.threshold-seconds:600}")
    private long fallbackThresholdSeconds;

    public void markStuckExecutionsAsFailed() {
        Instant now = Instant.now();

        // Coarse, index-backed pre-filter: no RUNNING row can be stuck before the
        // smallest possible per-row threshold elapses. Refine precisely in memory.
        long coarseFloorSeconds = Math.min(graceSeconds, fallbackThresholdSeconds);
        List<ScriptExecution> candidates = scriptExecutionRepository.findByStatusAndDispatchedAtBefore(
                ExecutionStatus.RUNNING, now.minusSeconds(coarseFloorSeconds));

        List<ScriptExecution> stuck = candidates.stream()
                .filter(row -> isStuck(row, now))
                .toList();
        if (stuck.isEmpty()) {
            log.debug("No stuck Execution rows found");
            return;
        }

        log.info("Found {} stuck Execution row(s) — transitioning to FAILED", stuck.size());
        stuck.forEach(row -> markFailing(row, now));
        scriptExecutionRepository.saveAll(stuck);

        log.info("Marked {} Execution row(s) as FAILED", stuck.size());

        finalizeAffectedScheduleHeaders(stuck);
    }

    private void finalizeAffectedScheduleHeaders(List<ScriptExecution> reaped) {
        reaped.stream()
                .filter(row -> row.getScheduleId() != null
                        && row.getTenantId() != null
                        && row.getExecutionId() != null)
                .map(row -> Map.entry(row.getTenantId(), row.getExecutionId()))
                .distinct()
                .forEach(e -> headerWatchdogService.finalizeIfSettled(e.getKey(), e.getValue()));
    }

    private boolean isStuck(ScriptExecution row, Instant now) {
        return row.getDispatchedAt() != null && row.getDispatchedAt().isBefore(now.minusSeconds(thresholdSecondsFor(row)));
    }

    private long thresholdSecondsFor(ScriptExecution row) {
        Integer timeout = row.getTimeoutSeconds();
        return timeout != null ? timeout + graceSeconds : fallbackThresholdSeconds;
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
}
