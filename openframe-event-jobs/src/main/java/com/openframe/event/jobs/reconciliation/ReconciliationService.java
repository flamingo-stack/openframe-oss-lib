package com.openframe.event.jobs.reconciliation;

import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.persistence.EventJob;
import com.openframe.event.jobs.persistence.EventJobStatus;
import com.openframe.event.jobs.service.EventJobService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.support.CronExpression;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

// Decides per copy whether a run starts, continues or waits for the cron, and leaves the batches to ReconciliationRunner.
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

    public void reconcile(MappedCopy copy, String jobId) {
        EventJob job = jobService.jobOf(jobId);
        Instant now = clock.instant();
        if (job.getStatus() == null) {
            String firstRunId = now.toString();
            startRun(copy, job, firstRunId);
            return;
        }
        if (job.getStatus() == EventJobStatus.RUNNING) {
            runner.checkBatches(copy, job);
            return;
        }
        Instant lastStartedAt = job.getStartedAt();
        Instant due = nextRunAfter(lastStartedAt);
        if (due.isAfter(now)) {
            log.debug("Reconciliation of {} is {}, the next run is due at {}", copy.getName(), job.getStatus(), due);
            return;
        }
        String runId = due.toString();
        startRun(copy, job, runId);
    }

    // Every pod reports the last finished run, so the metric does not depend on which pod ran it.
    public void reportLastResult(MappedCopy copy, String jobId) {
        EventJob job = jobService.jobOf(jobId);
        long lastMismatches = job.getLastMismatches();
        metrics.report(copy, lastMismatches);
    }

    // The run id is the cron's fire time, the same on every pod.
    private void startRun(MappedCopy copy, EventJob job, String runId) {
        EventJob started = jobService.startRun(job, runId);
        log.info("Reconciliation of {} started, run {}", copy.getName(), runId);
        runner.checkBatches(copy, started);
    }

    private Instant nextRunAfter(Instant startedAt) {
        ZonedDateTime started = startedAt.atZone(ZoneOffset.UTC);
        ZonedDateTime next = cron.next(started);
        return next.toInstant();
    }
}
