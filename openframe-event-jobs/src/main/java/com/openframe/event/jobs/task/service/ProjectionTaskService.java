package com.openframe.event.jobs.task.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.service.EventJobProgressStore;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.event.jobs.task.repository.ProjectionTaskRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

// Saves the copies ProjectionTask makes; a save throws OptimisticLockingFailureException when another copy is newer.
@Slf4j
@RequiredArgsConstructor
public class ProjectionTaskService implements EventJobProgressStore<ProjectionTask> {

    private static final int MAX_SUBMIT_ATTEMPTS = 3;

    private final ProjectionTaskRepository taskRepository;
    private final ProjectionTaskEnvelopes envelopes;
    private final Clock clock;

    // A RUNNING or FAILED task: every event of its source goes to it, so an older value never lands after a newer one.
    public boolean hasTask(String projection, String tenantId, String sourceId) {
        String id = ProjectionTask.buildId(projection, tenantId, sourceId);
        return taskRepository.existsById(id);
    }

    // Opens the task, or starts it again with this newer event; a worker's save in between conflicts, so it tries again.
    public void submit(String projection, String type, String sourceId, PublishedRecord<?> record) {
        String tenantId = record.getTenantId();
        long eventVersion = record.getVersion();
        Map<String, Object> envelope = envelopes.toEnvelope(record);
        Instant now = clock.instant();
        ProjectionTask opened = ProjectionTask.open(projection, type, tenantId, sourceId, envelope, eventVersion, now);
        for (int attempt = 1; ; attempt++) {
            try {
                saveSubmitted(opened);
                return;
            } catch (OptimisticLockingFailureException | DuplicateKeyException conflict) {
                if (attempt == MAX_SUBMIT_ATTEMPTS) {
                    throw conflict;
                }
                log.debug("Projection task {} changed meanwhile, attempt {}: {}", opened.getId(), attempt, conflict.toString());
            }
        }
    }

    // A task already there keeps its createdAt and its version, so the save checks it.
    private void saveSubmitted(ProjectionTask opened) {
        String id = opened.getId();
        Map<String, Object> envelope = opened.getEnvelope();
        long eventVersion = opened.getEventVersion();
        Instant now = clock.instant();
        ProjectionTask submitted = taskRepository.findById(id)
                .map(existing -> existing.restartWith(envelope, eventVersion, now))
                .orElse(opened);
        taskRepository.save(submitted);
        String change = submitted == opened ? "opened" : "started again";
        log.info("Projection task {} {} with event version {}", id, change, eventVersion);
    }

    // The task as saved now, or a gone one without status.
    public ProjectionTask findTask(String id) {
        return taskRepository.findById(id).orElseGet(() -> ProjectionTask.gone(id));
    }

    public List<ProjectionTask> runningTasks() {
        return taskRepository.findByStatusOrderByStartedAtAsc(EventJobStatus.RUNNING);
    }

    public ProjectionTask saveBatch(ProjectionTask task, String lastId) {
        Instant now = clock.instant();
        ProjectionTask progressed = task.recordBatch(lastId, now);
        return taskRepository.save(progressed);
    }

    @Override
    public ProjectionTask recordFailure(ProjectionTask task, String error) {
        Instant now = clock.instant();
        ProjectionTask failed = task.recordFailure(error, now);
        return taskRepository.save(failed);
    }

    // FAILED stays in event_projection_tasks, for the alert and for the next event of the source, which starts it again.
    @Override
    public ProjectionTask finishRun(ProjectionTask task, EventJobStatus status) {
        Instant now = clock.instant();
        ProjectionTask finished = task.finish(status, now);
        return taskRepository.save(finished);
    }

    // Deleted only if no newer event started it again meanwhile; then the next tick runs it with that event.
    public ProjectionTask finish(ProjectionTask task) {
        String id = task.getId();
        Long version = task.getVersion();
        long deleted = taskRepository.deleteByIdAndVersion(id, version);
        if (deleted == 0) {
            log.info("Projection task {} has a newer event: it runs again at the next tick", id);
        } else {
            log.info("Projection task {} done after {} batch(es), {}", id, task.getBatches(), task.getRunId());
        }
        Instant now = clock.instant();
        return task.finish(EventJobStatus.DONE, now);
    }

    public long countRunning(String projection) {
        return taskRepository.countByProjectionAndStatus(projection, EventJobStatus.RUNNING);
    }

    // Zero without a RUNNING task; startedAt, since a newer event starts the task again.
    public Duration oldestRunningAge(String projection) {
        Instant now = clock.instant();
        return taskRepository.findFirstByProjectionAndStatusOrderByStartedAtAsc(projection, EventJobStatus.RUNNING)
                .map(task -> Duration.between(task.getStartedAt(), now))
                .orElse(Duration.ZERO);
    }
}
