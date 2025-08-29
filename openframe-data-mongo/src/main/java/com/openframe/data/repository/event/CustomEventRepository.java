package com.openframe.data.repository.event;

import com.openframe.data.document.event.Event;
import com.openframe.data.document.event.filter.EventQueryFilter;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

public interface CustomEventRepository {
    Query buildEventQuery(EventQueryFilter filter, String search);

    List<Event> findEventsWithCursor(Query query, String cursor, int limit);

    List<String> findDistinctUserIds();

    List<String> findDistinctEventTypes();
}