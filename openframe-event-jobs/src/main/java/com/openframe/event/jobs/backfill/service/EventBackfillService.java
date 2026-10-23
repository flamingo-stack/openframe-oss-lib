package com.openframe.event.jobs.backfill.service;

import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.publishing.registry.PublishedAggregates;
import lombok.extern.slf4j.Slf4j;

import java.time.Clock;
import java.time.Instant;

// Decides per type whether a run starts, continues or is done, and leaves the batches to EventBackfillRunner.
@Slf4j
public class EventBackfillService {

    private final PublishedAggregates publishedAggregates;
    private final EventJobService jobService;
    private final EventBackfillRunner runner;
    // A FAILED run is tried again only by a pod that started after it failed, so a fix is deployed first.
    private final Instant podStartedAt;

    public EventBackfillService(PublishedAggregates publishedAggregates, EventJobService jobService, EventBackfillRunner runner,
                                Clock clock) {
        this.publishedAggregates = publishedAggregates;
        this.jobService = jobService;
        this.runner = runner;
        this.podStartedAt = clock.instant();
    }

    public void backfill(String type, String runId, String jobId) {
        if (!publishedAggregates.isPublishing(type)) {
            log.debug("Backfill of {} skipped: the type is switched off in this service, run {}", type, runId);
            return;
        }
        EventJob job = jobService.jobOf(jobId);
        if (job.wasReplaced(runId)) {
            log.warn("Backfill of {} skipped: run {} was replaced by run {}; this pod has the old config", type, runId,
                    job.getRunId());
            return;
        }
        if (!job.isRunOf(runId)) {
            EventJob started = jobService.startRun(job, runId);
            log.info("Backfill of {} started, run {}", type, runId);
            runner.writeBatches(type, started);
            return;
        }
        switch (job.getStatus()) {
            case RUNNING -> runner.writeBatches(type, job);
            case FAILED -> resumeFailed(type, job);
            case DONE -> log.debug("Backfill of {} is done, run {}", type, runId);
        }
    }

    private void resumeFailed(String type, EventJob job) {
        Instant failedAt = job.getFinishedAt();
        if (!failedAt.isBefore(podStartedAt)) {
            log.debug("Backfill of {} stays FAILED until a pod restart or a new run id, run {}", type, job.getRunId());
            return;
        }
        EventJob resumed = jobService.resumeRun(job);
        log.info("Backfill of {} resumed after FAILED, run {}, after {}", type, resumed.getRunId(), resumed.getLastId());
        runner.writeBatches(type, resumed);
    }
}
