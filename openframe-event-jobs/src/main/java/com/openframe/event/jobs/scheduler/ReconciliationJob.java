package com.openframe.event.jobs.scheduler;

import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.lock.EventJobLock;
import com.openframe.event.jobs.reconciliation.MappedCopy;
import com.openframe.event.jobs.reconciliation.ReconciliationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;
import java.util.List;

// Compares every copied field with its source and reports the rows that differ; it repairs nothing.
@Slf4j
@RequiredArgsConstructor
public class ReconciliationJob {

    private static final String JOB_PREFIX = "reconciliation:";

    private final ReconciliationProperties properties;
    private final List<MappedCopy> copies;
    private final EventJobLock jobLock;
    private final ReconciliationService reconciliationService;

    // The service enables scheduling (@EnableScheduling), so the module does not switch it on for every service that adds it.
    @Scheduled(fixedDelayString = "${openframe.events.jobs.reconciliation.poll-interval:30s}")
    public void runAll() {
        copies.forEach(this::runLocked);
    }

    // One copy's error, Mongo down included, does not skip the other copies of the tick.
    private void runLocked(MappedCopy copy) {
        String jobId = JOB_PREFIX + copy.getName();
        Duration lockAtMostFor = properties.getLockAtMostFor();
        try {
            reconciliationService.reportLastResult(copy, jobId);
            jobLock.runExclusively(jobId, lockAtMostFor, () -> reconciliationService.reconcile(copy, jobId));
        } catch (RuntimeException failure) {
            log.error("Reconciliation of {} tick failed; the next tick tries again", copy.getName(), failure);
        }
    }
}
