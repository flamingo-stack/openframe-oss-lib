package com.openframe.event.jobs.reconciliation.scheduler;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.reconciliation.service.ReconciliationService;
import com.openframe.publishing.api.spec.Projection;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;
import java.util.List;

// Reconciles each projection it is given with its source and reports the projected items that differ; it repairs nothing.
@Slf4j
@RequiredArgsConstructor
public class ReconciliationJob {

    private static final String JOB_PREFIX = "reconciliation:";

    private final ReconciliationProperties properties;
    private final List<Projection<?, ?>> projections;
    private final EventJobLock jobLock;
    private final ReconciliationService reconciliationService;

    // The service enables scheduling (@EnableScheduling), so the module does not switch it on for every service that adds it.
    @Scheduled(fixedDelayString = "${openframe.events.jobs.reconciliation.poll-interval:30s}")
    public void runAll() {
        projections.forEach(this::runLocked);
    }

    // One projection's error, Mongo down included, does not skip the other projections of the tick.
    private void runLocked(Projection<?, ?> projection) {
        String jobId = JOB_PREFIX + projection.name();
        Duration lockAtMostFor = properties.getLockAtMostFor();
        try {
            reconciliationService.reportLastResult(projection, jobId);
            jobLock.runExclusively(jobId, lockAtMostFor, () -> reconciliationService.reconcile(projection, jobId));
        } catch (RuntimeException failure) {
            log.error("Reconciliation of {} tick failed; the next tick tries again", projection.name(), failure);
        }
    }
}
