package com.openframe.management.service;

import com.openframe.data.document.rmm.Execution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.repository.rmm.ExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Reaps {@link Execution} rows that have been in {@link ExecutionStatus#RUNNING}
 * past the stuck-threshold and transitions them to {@link ExecutionStatus#FAILING}.
 *
 * <p>Backstop for two failure modes that the result-side handler cannot
 * resolve on its own:
 * <ol>
 *   <li>NATS publish of the dispatch failed after the row was already
 *       persisted — agent never receives the work, so no result frame ever
 *       arrives. Row would otherwise hang in {@code RUNNING} forever.</li>
 *   <li>Agent is offline / wedged / never responds — same outcome.</li>
 * </ol>
 *
 * <p>The reaped row gets {@code timedOut = true} and a descriptive
 * {@code error} so the History UI can distinguish "watchdog gave up" from
 * "agent reported a real failure".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExecutionWatchdogService {

    private static final String STUCK_ERROR_MESSAGE_FORMAT =
            "No result received within %d seconds; watchdog marked execution as failed";

    private final ExecutionRepository executionRepository;

    @Value("${openframe.rmm.execution.watchdog.threshold-seconds:600}")
    private long stuckThresholdSeconds;

    public void markStuckExecutionsAsFailing() {
        Instant threshold = Instant.now().minusSeconds(stuckThresholdSeconds);
        List<Execution> stuck = executionRepository.findByStatusAndDispatchedAtBefore(
                ExecutionStatus.RUNNING, threshold);
        if (stuck.isEmpty()) {
            log.debug("No stuck Execution rows found");
            return;
        }

        log.info("Found {} stuck Execution row(s) older than {}s — transitioning to FAILING",
                stuck.size(), stuckThresholdSeconds);
        Instant now = Instant.now();
        String errorMsg = STUCK_ERROR_MESSAGE_FORMAT.formatted(stuckThresholdSeconds);
        stuck.forEach(row -> markFailing(row, now, errorMsg));
        executionRepository.saveAll(stuck);

        log.info("Marked {} Execution row(s) as FAILING", stuck.size());
    }

    private static void markFailing(Execution row, Instant now, String errorMsg) {
        row.setStatus(ExecutionStatus.FAILING);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setTimedOut(Boolean.TRUE);
        row.setError(errorMsg);
        log.info("Reaping stuck Execution: executionId={} machineId={} dispatchedAt={}",
                row.getExecutionId(), row.getMachineId(), row.getDispatchedAt());
    }
}
