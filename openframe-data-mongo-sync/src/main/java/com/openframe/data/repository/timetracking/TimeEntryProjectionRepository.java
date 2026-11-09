package com.openframe.data.repository.timetracking;

import com.mongodb.ReadPreference;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.TimeEntry.Fields;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.util.List;

// The projections' time entry writes; TimeEntryRepository is tenant-aware and absent in the stream, so each names the tenant.
@Repository
@RequiredArgsConstructor
public class TimeEntryProjectionRepository {

    // From the primary: a lagging secondary could count 0 or miss items, and the event would skip a real update.
    private static final ReadPreference PRIMARY = ReadPreference.primary();

    private final MongoOperations mongoOperations;

    public long updateTicketTitle(String tenantId, String ticketId, String ticketTitle) {
        Criteria timeEntriesToUpdate = matchTimeEntriesToUpdateTicketTitle(tenantId, ticketId, ticketTitle);
        Query query = new Query(timeEntriesToUpdate);
        Update update = new Update().set(Fields.ticketTitle, ticketTitle);
        UpdateResult result = mongoOperations.updateMulti(query, update, TimeEntry.class);
        return result.getModifiedCount();
    }

    public long countTimeEntriesToUpdateTicketTitle(String tenantId, String ticketId, String ticketTitle, int limit) {
        Criteria timeEntriesToUpdate = matchTimeEntriesToUpdateTicketTitle(tenantId, ticketId, ticketTitle);
        Query query = new Query(timeEntriesToUpdate).limit(limit);
        query.withReadPreference(PRIMARY);
        return mongoOperations.count(query, TimeEntry.class);
    }

    // One batch in _id order after lastId (null for the first); returns its last _id, or null when none is left.
    public String updateTicketTitleBatch(String tenantId, String ticketId, String ticketTitle, String lastId, int batchSize) {
        Criteria timeEntriesToUpdate = matchTimeEntriesToUpdateTicketTitle(tenantId, ticketId, ticketTitle);
        List<String> batchIds = findIdsAfter(timeEntriesToUpdate, lastId, batchSize);
        if (batchIds.isEmpty()) {
            return null;
        }
        Criteria batchTimeEntries = matchTimeEntriesToUpdateTicketTitle(tenantId, ticketId, ticketTitle)
                .and(Fields.id).in(batchIds);
        Query query = new Query(batchTimeEntries);
        Update update = new Update().set(Fields.ticketTitle, ticketTitle);
        mongoOperations.updateMulti(query, update, TimeEntry.class);
        return batchIds.getLast();
    }

    private List<String> findIdsAfter(Criteria criteria, String lastId, int batchSize) {
        if (lastId != null) {
            criteria.and(Fields.id).gt(lastId);
        }
        Query query = new Query(criteria).with(Sort.by(Fields.id)).limit(batchSize);
        query.fields().include(Fields.id);
        query.withReadPreference(PRIMARY);
        return mongoOperations.find(query, TimeEntry.class).stream()
                .map(TimeEntry::getId)
                .toList();
    }

    private static Criteria matchTimeEntriesToUpdateTicketTitle(String tenantId, String ticketId, String ticketTitle) {
        return Criteria.where(Fields.tenantId).is(tenantId)
                .and(Fields.ticketId).is(ticketId)
                .and(Fields.ticketTitle).ne(ticketTitle);
    }
}
