package com.openframe.event.jobs.core.repository;

import com.openframe.event.jobs.core.persistence.EventJob;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.ReadPreference;

import java.util.Optional;

// From the primary: the service's default (secondaryPreferred) could hand a tick an older copy, and every save would conflict.
@ReadPreference("primary")
public interface EventJobRepository extends MongoRepository<EventJob, String> {

    Optional<EventJob> findFirstByJobIdOrderByStartedAtDesc(String jobId);

    boolean existsByJobIdAndRunId(String jobId, String runId);
}
