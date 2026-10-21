package com.openframe.event.jobs.backfill;

import com.openframe.event.jobs.persistence.EventJob;
import com.openframe.event.jobs.service.EventJobService;
import com.openframe.publishing.api.PublishedAggregateType;
import com.openframe.publishing.api.PublishedAggregates;
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

    public void backfill(PublishedAggregateType type, String runId, String jobId) {
        if (!publishedAggregates.isPublishing(type)) {
            log.warn("Backfill of {} skipped: the type has no spec or its publish is off in this service, run {}", type.getName(), runId);
            return;
        }
        EventJob job = jobService.jobOf(jobId);
        if (job.wasReplaced(runId)) {
            log.warn("Backfill of {} skipped: run {} was replaced by run {}; this pod has the old config", type.getName(), runId,
                    job.getRunId());
            return;
        }
        if (!job.isRunOf(runId)) {
            EventJob started = jobService.startRun(job, runId);
            log.info("Backfill of {} started, run {}", type.getName(), runId);
            runner.writeBatches(type, started);
            return;
        }
        switch (job.getStatus()) {
            case RUNNING -> runner.writeBatches(type, job);
            case FAILED -> resumeFailed(type, job);
            case DONE -> log.debug("Backfill of {} is done, run {}", type.getName(), runId);
        }
    }

    private void resumeFailed(PublishedAggregateType type, EventJob job) {
        Instant failedAt = job.getFinishedAt();
        if (!failedAt.isBefore(podStartedAt)) {
            log.debug("Backfill of {} stays FAILED until a pod restart or a new run id, run {}", type.getName(), job.getRunId());
            return;
        }
        EventJob resumed = jobService.resumeRun(job);
        log.info("Backfill of {} resumed after FAILED, run {}, after {}", type.getName(), resumed.getRunId(), resumed.getLastId());
        runner.writeBatches(type, resumed);
    }
}
