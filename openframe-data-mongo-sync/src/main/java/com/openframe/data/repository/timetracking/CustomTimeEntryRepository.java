package com.openframe.data.repository.timetracking;

import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.filter.TimeEntryQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public interface CustomTimeEntryRepository {

    Query buildTimeEntryQuery(TimeEntryQueryFilter filter);

    List<TimeEntry> findTimeEntriesWithCursor(Query query, String cursor, int limit,
                                              String sortField, String sortDirection);

    long countTimeEntries(Query query);

    /**
     * Sum of completed-entry duration scoped by optional userIds and organizationIds.
     * Null/empty userIds = all users in tenant; null/empty organizationIds = no org filter.
     */
    long sumDurationSeconds(List<String> userIds, List<String> organizationIds, Instant from, Instant to);

    long countCompletedEntries(List<String> userIds, List<String> organizationIds, Instant from, Instant to);

    long countDistinctActiveDays(List<String> userIds, List<String> organizationIds, Instant from, Instant to);

    Map<String, Long> sumDurationSecondsByTicketIds(List<String> ticketIds);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
