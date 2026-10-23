package com.openframe.event.jobs.task.repository;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.ReadPreference;

import java.util.List;
import java.util.Optional;

// From the primary, as event_job_runs: an older copy from a secondary would fail every save.
@ReadPreference("primary")
public interface ProjectionTaskRepository extends MongoRepository<ProjectionTask, String> {

    List<ProjectionTask> findByStatusOrderByStartedAtAsc(EventJobStatus status);

    long countByProjectionAndStatus(String projection, EventJobStatus status);

    Optional<ProjectionTask> findFirstByProjectionAndStatusOrderByStartedAtAsc(String projection, EventJobStatus status);

    long deleteByIdAndVersion(String id, Long version);
}
