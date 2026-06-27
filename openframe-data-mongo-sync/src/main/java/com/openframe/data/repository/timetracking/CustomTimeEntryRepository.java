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

    long sumDurationSecondsByUser(String userId, Instant from, Instant to);

    long countCompletedEntriesByUser(String userId, Instant from, Instant to);

    long countDistinctActiveDaysByUser(String userId, Instant from, Instant to);

    Map<String, Long> sumDurationSecondsByTicketIds(List<String> ticketIds);

    boolean isSortableField(String field);

    String getDefaultSortField();
}
