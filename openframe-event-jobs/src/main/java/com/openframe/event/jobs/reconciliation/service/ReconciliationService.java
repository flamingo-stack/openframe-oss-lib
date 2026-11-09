package com.openframe.event.jobs.reconciliation.service;

import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobService;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.publishing.api.spec.Projection;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.support.CronExpression;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

// Decides per projection whether a run starts, continues or waits for the cron, and leaves the batches to ReconciliationRunner.
@Slf4j
public class ReconciliationService {

    private final EventJobService jobService;
    private final ReconciliationRunner runner;
    private final ReconciliationMetrics metrics;
    private final Clock clock;
    private final CronExpression cron;

    public ReconciliationService(ReconciliationProperties properties, EventJobService jobService,
                                 ReconciliationRunner runner, ReconciliationMetrics metrics, Clock clock) {
        this.jobService = jobService;
        this.runner = runner;
        this.metrics = metrics;
        this.clock = clock;
        String cronExpression = properties.getCron();
        this.cron = CronExpression.parse(cronExpression);
    }

    public void reconcile(Projection<?, ?> projection, String jobId) {
        EventJob job = jobService.findCurrentRun(jobId);
        Instant now = clock.instant();
        if (job.getStatus() == null) {
            String firstRunId = now.toString();
            startRun(projection, job, firstRunId);
            return;
        }
        if (job.getStatus() == EventJobStatus.RUNNING) {
            runner.checkBatches(projection, job);
            return;
        }
        Instant lastStartedAt = job.getStartedAt();
        Instant due = nextRunAfter(lastStartedAt);
        if (due.isAfter(now)) {
            log.debug("Reconciliation of {} is {}, the next run is due at {}", projection.name(), job.getStatus(), due);
            return;
        }
        String runId = due.toString();
        startRun(projection, job, runId);
    }

    // Every pod reports the last finished run, so the metric does not depend on which pod ran it.
    public void reportLastResult(Projection<?, ?> projection, String jobId) {
        EventJob job = jobService.findCurrentRun(jobId);
        long lastMismatches = job.getLastMismatches();
        metrics.report(projection, lastMismatches);
    }

    // The run id is the cron's fire time, the same on every pod.
    private void startRun(Projection<?, ?> projection, EventJob job, String runId) {
        EventJob started = jobService.startRun(job, runId);
        log.info("Reconciliation of {} started, run {}", projection.name(), runId);
        runner.checkBatches(projection, started);
    }

    private Instant nextRunAfter(Instant startedAt) {
        ZonedDateTime started = startedAt.atZone(ZoneOffset.UTC);
        ZonedDateTime next = cron.next(started);
        return next.toInstant();
    }
}
