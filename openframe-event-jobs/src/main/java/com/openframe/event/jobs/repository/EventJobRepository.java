package com.openframe.event.jobs.repository;

import com.openframe.event.jobs.persistence.EventJob;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.ReadPreference;

// From the primary: the service's default (secondaryPreferred) could hand a tick an older copy, and every save would conflict.
@ReadPreference("primary")
public interface EventJobRepository extends MongoRepository<EventJob, String> {
}
