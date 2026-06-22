package com.openframe.data.repository.timetracking;

import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.repository.TenantAwareRepository;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@TenantAwareRepository
public interface TimeEntryRepository extends MongoRepository<TimeEntry, String>, CustomTimeEntryRepository {

    Optional<TimeEntry> findByUserIdAndEndedAtIsNull(String userId);
}
