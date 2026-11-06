package com.openframe.event.jobs.task.persistence;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.SmartLifecycle;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;

// Explicit like OutboxIndexInitializer: auto-index-creation is off by default, so @Indexed alone would create nothing.
@Slf4j
@RequiredArgsConstructor
public class ProjectionTaskIndexInitializer implements SmartLifecycle {

    // One current run per source and projection: a second submit of the same source fails its insert and tries again.
    static final String ONE_CURRENT_RUN_PER_SOURCE = "event_projection_tasks_key_open_unique";
    // The worker's RUNNING runs (the few it finds are sorted in memory) and the metrics' RUNNING runs per projection.
    static final String RUNNING_RUNS = "event_projection_tasks_status_projection_startedAt";

    private final MongoOperations mongoOperations;
    private volatile boolean running;

    // Phase 0, as OutboxIndexInitializer: after the context refresh, before the first event or tick.
    @Override
    public int getPhase() {
        return 0;
    }

    @Override
    public void start() {
        Criteria isCurrent = Criteria.where(ProjectionTask.Fields.current).is(true);
        PartialIndexFilter onlyCurrent = PartialIndexFilter.of(isCurrent);
        Index oneCurrentRunPerSource = new Index()
            .on(ProjectionTask.Fields.key, Sort.Direction.ASC)
            .unique()
            .partial(onlyCurrent)
            .named(ONE_CURRENT_RUN_PER_SOURCE);
        Index runningRuns = new Index()
            .on(ProjectionTask.Fields.status, Sort.Direction.ASC)
            .on(ProjectionTask.Fields.projection, Sort.Direction.ASC)
            .on(ProjectionTask.Fields.startedAt, Sort.Direction.ASC)
            .named(RUNNING_RUNS);

        mongoOperations.indexOps(ProjectionTask.class)
            .createIndex(oneCurrentRunPerSource);
        mongoOperations.indexOps(ProjectionTask.class)
            .createIndex(runningRuns);

        log.debug("Ensured indexes {} and {} on the projection tasks", ONE_CURRENT_RUN_PER_SOURCE, RUNNING_RUNS);
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
