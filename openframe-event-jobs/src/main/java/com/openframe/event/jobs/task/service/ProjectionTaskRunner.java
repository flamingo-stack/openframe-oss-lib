package com.openframe.event.jobs.task.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobTicker;
import com.openframe.event.jobs.task.config.properties.ProjectionTaskProperties;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.Projection;
import lombok.extern.slf4j.Slf4j;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

// Works one task for a tick: its projection's batches in _id order, each saved, then deletes the task when none is left.
@Slf4j
public class ProjectionTaskRunner {

    private final ProjectionTaskProperties properties;
    private final Map<String, Projection<?, ?>> projectionsByName;
    private final ProjectionTaskService taskService;
    private final ProjectionTaskEnvelopes envelopes;
    private final EventJobTicker<ProjectionTask> ticker;
    private final ProjectionTaskMetrics metrics;

    public ProjectionTaskRunner(ProjectionTaskProperties properties, List<Projection<?, ?>> projections,
                                ProjectionTaskService taskService, ProjectionTaskEnvelopes envelopes,
                                EventJobTicker<ProjectionTask> ticker, ProjectionTaskMetrics metrics) {
        Map<String, Projection<?, ?>> byName = new HashMap<>();
        for (Projection<?, ?> projection : projections) {
            String name = projection.name();
            byName.put(name, projection);
        }
        this.properties = properties;
        this.projectionsByName = Map.copyOf(byName);
        this.taskService = taskService;
        this.envelopes = envelopes;
        this.ticker = ticker;
        this.metrics = metrics;
    }

    // Read again under the lock: the listed copy may be older than the restart a newer event made.
    public void applyBatches(String taskId) {
        ProjectionTask task = taskService.findTask(taskId);
        if (task.getStatus() != EventJobStatus.RUNNING) {
            log.debug("Projection task {} is {}: nothing to do", taskId, task.getStatus());
            return;
        }
        String projectionName = task.getProjection();
        Projection<?, ?> projection = projectionsByName.get(projectionName);
        if (projection == null) {
            log.warn("Projection task {} skipped: this service has no projection {}", taskId, projectionName);
            return;
        }
        String jobName = "Projection task " + taskId;
        ticker.tick(jobName, task, properties, current -> applyBatch(projection, current),
                () -> metrics.recordFailed(projectionName));
    }

    public void reportOpenTasks(Projection<?, ?> projection) {
        String name = projection.name();
        long open = taskService.countRunning(name);
        Duration oldestAge = taskService.oldestRunningAge(name);
        metrics.report(name, open, oldestAge);
    }

    // Read in every batch, so a broken envelope counts as a failure and ends FAILED like any other.
    private ProjectionTask applyBatch(Projection<?, ?> projection, ProjectionTask task) {
        PublishedRecord<?> record = envelopes.toRecord(task);
        String lastId = task.getLastId();
        int batchSize = properties.getBatchSize();
        String batchLastId = applyTyped(projection, record, lastId, batchSize);
        if (batchLastId == null) {
            return taskService.finish(task);
        }
        ProjectionTask saved = taskService.saveBatch(task, batchLastId);
        log.debug("Projection task {} wrote batch {}, up to {}", task.getId(), saved.getBatches(), batchLastId);
        return saved;
    }

    // A record of the wrong event class fails with ClassCastException, which counts like any other failure.
    @SuppressWarnings({"unchecked", "rawtypes"})
    private static String applyTyped(Projection projection, PublishedRecord record, String lastId, int batchSize) {
        return projection.applyBatch(record, lastId, batchSize);
    }
}
