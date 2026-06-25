package com.openframe.management.service;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptExecutionStatus;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * Reaps {@link ScriptExecution} rows that have been in {@link ScriptExecutionStatus#RUNNING}
 * past the stuck-threshold and transitions them to {@link ScriptExecutionStatus#FAILED}.
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
 *
 * <p>The stuck-threshold is <b>per-execution</b>, not one fixed value for every
 * script: a row is reaped once it outlives its own dispatch
 * {@code timeoutSeconds} plus a grace buffer (covering dispatch + result
 * propagation latency). This keeps a legitimately long-running script from
 * being reaped prematurely while still catching a short script quickly. Rows
 * dispatched without a timeout fall back to a fixed threshold. A coarse,
 * index-backed pre-filter ({@code status = RUNNING AND dispatchedAt < now − minThreshold})
 * narrows the candidates; the precise per-row threshold is then applied
 * in-memory.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptExecutionWatchdogService {

    private static final String STUCK_ERROR_MESSAGE_FORMAT =
            "No result received within %d seconds; watchdog marked execution as failed";

    private final ScriptExecutionRepository scriptExecutionRepository;

    /**
     * Grace buffer (seconds) added on top of each execution's own
     * {@code timeoutSeconds} before it is considered stuck — covers dispatch +
     * result-propagation latency (NATS publish, agent pickup, result round-trip
     * through Kafka). Kept generous: a premature reap is lossy, since the
     * result-side handler refuses to overwrite a terminal row.
     */
    @Value("${openframe.rmm.execution.watchdog.grace-seconds:120}")
    private long graceSeconds;

    /** Fallback threshold (seconds) for rows dispatched without a timeout. */
    @Value("${openframe.rmm.execution.watchdog.threshold-seconds:600}")
    private long fallbackThresholdSeconds;

    public void markStuckExecutionsAsFailing() {
        Instant now = Instant.now();

        // Coarse, index-backed pre-filter: no RUNNING row can be stuck before the
        // smallest possible per-row threshold elapses. Refine precisely in memory.
        long coarseFloorSeconds = Math.min(graceSeconds, fallbackThresholdSeconds);
        List<ScriptExecution> candidates = scriptExecutionRepository.findByStatusAndDispatchedAtBefore(
                ScriptExecutionStatus.RUNNING, now.minusSeconds(coarseFloorSeconds));

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
    }

    /**
     * A RUNNING row is stuck once it has outlived its per-execution threshold:
     * its own {@code timeoutSeconds + grace}, or the fixed fallback when no
     * timeout was recorded.
     */
    private boolean isStuck(ScriptExecution row, Instant now) {
        return row.getDispatchedAt() != null
                && row.getDispatchedAt().isBefore(now.minusSeconds(thresholdSecondsFor(row)));
    }

    private long thresholdSecondsFor(ScriptExecution row) {
        Integer timeout = row.getTimeoutSeconds();
        return timeout != null ? timeout + graceSeconds : fallbackThresholdSeconds;
    }

    private void markFailing(ScriptExecution row, Instant now) {
        long thresholdSeconds = thresholdSecondsFor(row);
        row.setStatus(ScriptExecutionStatus.FAILED);
        row.setStatusChangedAt(now);
        row.setFinishedAt(now);
        row.setTimedOut(Boolean.TRUE);
        row.setError(STUCK_ERROR_MESSAGE_FORMAT.formatted(thresholdSeconds));
        log.info("Reaping stuck Execution: executionId={} machineId={} dispatchedAt={} thresholdSeconds={}",
                row.getExecutionId(), row.getMachineId(), row.getDispatchedAt(), thresholdSeconds);
    }
}
