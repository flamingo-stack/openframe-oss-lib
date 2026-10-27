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
import java.util.Optional;

// Saves the copies ProjectionTask makes, one per run; saving an older copy throws OptimisticLockingFailureException.
@Slf4j
@RequiredArgsConstructor
public class ProjectionTaskService implements EventJobProgressStore<ProjectionTask> {

    private static final int MAX_SUBMIT_ATTEMPTS = 3;

    private final ProjectionTaskRepository taskRepository;
    private final ProjectionTaskEnvelopes envelopes;
    private final Clock clock;

    // While a source has a current run, its events go to the tasks, so an older value never lands after a newer one.
    public boolean hasTask(String projection, String tenantId, String sourceId) {
        String key = ProjectionTask.buildKey(projection, tenantId, sourceId);
        return taskRepository.existsByKeyAndCurrentTrue(key);
    }

    // Closes the source's current run and opens a new one; a worker's save in between conflicts, so it tries again.
    public void submit(String projection, String type, String sourceId, PublishedRecord<?> record) {
        String tenantId = record.getTenantId();
        long eventVersion = record.getVersion();
        Map<String, Object> envelope = envelopes.toEnvelope(record);
        for (int attempt = 1; ; attempt++) {
            Instant now = clock.instant();
            ProjectionTask opened = ProjectionTask.open(projection, type, tenantId, sourceId, envelope, eventVersion, now);
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

    // The current run's save checks its version, the unique index stops a second current run, and an older event is dropped.
    private void saveSubmitted(ProjectionTask opened) {
        String key = opened.getKey();
        Instant now = clock.instant();
        Optional<ProjectionTask> currentRun = taskRepository.findByKeyAndCurrentTrue(key);
        if (currentRun.isPresent()) {
            ProjectionTask current = currentRun.get();
            if (current.getEventVersion() > opened.getEventVersion()) {
                log.info("Projection task {} keeps event version {}: version {} is older", current.getId(),
                        current.getEventVersion(), opened.getEventVersion());
                return;
            }
            ProjectionTask closed = current.close(now);
            taskRepository.save(closed);
            log.info("Projection task {} closed {} for a newer event", closed.getId(), closed.getStatus());
        }
        taskRepository.insert(opened);
        log.info("Projection task {} opened with event version {}", opened.getId(), opened.getEventVersion());
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

    // A FAILED run stays current, for the alert, until the next event of its source closes it.
    @Override
    public ProjectionTask finishRun(ProjectionTask task, EventJobStatus status) {
        Instant now = clock.instant();
        ProjectionTask finished = task.finish(status, now);
        return taskRepository.save(finished);
    }

    // Kept DONE; if a newer event closed the run meanwhile, its save conflicts and the next tick runs the newer run.
    public ProjectionTask finish(ProjectionTask task) {
        String id = task.getId();
        Instant now = clock.instant();
        ProjectionTask done = task.finish(EventJobStatus.DONE, now);
        try {
            ProjectionTask saved = taskRepository.save(done);
            log.info("Projection task {} done after {} batch(es), {}", id, task.getBatches(), task.getRunId());
            return saved;
        } catch (OptimisticLockingFailureException newerEvent) {
            log.info("Projection task {} was closed by a newer event: its new run starts at the next tick", id);
            return done;
        }
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
