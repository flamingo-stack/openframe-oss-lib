package com.openframe.event.jobs.core.persistence;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.SmartLifecycle;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.index.Index;

// Explicit like OutboxIndexInitializer: auto-index-creation is off by default, so @Indexed alone would create nothing.
@Slf4j
@RequiredArgsConstructor
public class EventJobRunIndexInitializer implements SmartLifecycle {

    // Runs are kept for good, as the jobs' history; this index finds a job's current run, its newest.
    static final String NEWEST_RUN_PER_JOB = "event_job_runs_jobId_startedAt";

    private final MongoOperations mongoOperations;
    private volatile boolean running;

    // Phase 0, as OutboxIndexInitializer: after the context refresh, before the jobs' first tick.
    @Override
    public int getPhase() {
        return 0;
    }

    @Override
    public void start() {
        Index newestRunPerJob = new Index()
            .on(EventJob.Fields.jobId, Sort.Direction.ASC)
            .on(EventJob.Fields.startedAt, Sort.Direction.DESC)
            .named(NEWEST_RUN_PER_JOB);

        mongoOperations.indexOps(EventJob.class)
            .createIndex(newestRunPerJob);

        log.debug("Ensured index {} on the job runs", NEWEST_RUN_PER_JOB);
        running = true;
    }

    @Override
    public void stop() {
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
