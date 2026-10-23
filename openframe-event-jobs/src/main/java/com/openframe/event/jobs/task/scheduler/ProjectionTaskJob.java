package com.openframe.event.jobs.task.scheduler;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.task.config.properties.ProjectionTaskProperties;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.event.jobs.task.service.ProjectionTaskRunner;
import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.publishing.api.spec.Projection;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Duration;
import java.util.List;

// Works every RUNNING task, each under its own lock, so several pods share them; a task continues from its lastId.
@Slf4j
@RequiredArgsConstructor
public class ProjectionTaskJob {

    private static final String LOCK_PREFIX = "projection-task:";

    private final ProjectionTaskProperties properties;
    private final List<Projection<?, ?>> projections;
    private final EventJobLock jobLock;
    private final ProjectionTaskService taskService;
    private final ProjectionTaskRunner runner;

    @Scheduled(fixedDelayString = "${openframe.events.jobs.projection-tasks.poll-interval:10s}")
    public void runAll() {
        projections.forEach(this::reportOpenTasks);
        List<ProjectionTask> runningTasks = taskService.runningTasks();
        runningTasks.forEach(this::runLocked);
    }

    // Every pod reports, so the metric does not depend on which pod works the tasks.
    private void reportOpenTasks(Projection<?, ?> projection) {
        try {
            runner.reportOpenTasks(projection);
        } catch (RuntimeException failure) {
            log.warn("Projection tasks of {} not reported: {}", projection.name(), failure.toString());
        }
    }

    // One task's error, Mongo down included, does not skip the other tasks of the tick.
    private void runLocked(ProjectionTask task) {
        String taskId = task.getId();
        String lockId = LOCK_PREFIX + taskId;
        Duration lockAtMostFor = properties.getLockAtMostFor();
        try {
            jobLock.runExclusively(lockId, lockAtMostFor, () -> runner.applyBatches(taskId));
        } catch (RuntimeException failure) {
            log.error("Projection task {} tick failed; the next tick tries again", taskId, failure);
        }
    }
}
