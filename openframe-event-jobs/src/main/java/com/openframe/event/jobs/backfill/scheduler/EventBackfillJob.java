package com.openframe.event.jobs.backfill.scheduler;

import com.openframe.event.jobs.backfill.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.backfill.service.EventBackfillService;
import com.openframe.event.jobs.core.lock.EventJobLock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;

// Writes the current state of every document of a type to the outbox, so its compacted topic holds them all; one lock per type.
@Slf4j
@RequiredArgsConstructor
public class EventBackfillJob {

    private static final String JOB_PREFIX = "backfill:";

    private final EventBackfillProperties properties;
    private final EventJobLock jobLock;
    private final EventBackfillService backfillService;

    // The service enables scheduling (@EnableScheduling), so the module does not switch it on for every service that adds it.
    @Scheduled(fixedDelayString = "${openframe.events.jobs.backfill.poll-interval:30s}")
    public void runAll() {
        properties.getRuns()
            .forEach(this::runLocked);
    }

    // One type's error, Mongo down included, does not skip the other types of the tick.
    private void runLocked(String type, String runId) {
        String jobId = JOB_PREFIX + type;
        Duration lockAtMostFor = properties.getLockAtMostFor();
        try {
            jobLock.runExclusively(jobId, lockAtMostFor, () -> backfillService.backfill(type, runId, jobId));
        } catch (RuntimeException failure) {
            log.error("Backfill of {} tick failed; the next tick tries again", type, failure);
        }
    }
}
