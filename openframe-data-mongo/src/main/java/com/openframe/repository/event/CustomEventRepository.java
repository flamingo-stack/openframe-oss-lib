package com.openframe.repository.event;

import com.openframe.documents.event.Event;
import com.openframe.documents.event.filter.EventQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

public interface CustomEventRepository {
    Query buildEventQuery(EventQueryFilter filter, String search);

    List<Event> findEventsWithCursor(Query query, String cursor, int limit);

    List<String> findDistinctUserIds();

    List<String> findDistinctEventTypes();
}