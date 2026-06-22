package com.openframe.data.repository.timetracking;

import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.filter.TimeEntryQueryFilter;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomTimeEntryRepositoryImpl extends TenantAwareRepositorySupport implements CustomTimeEntryRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String DEFAULT_SORT_FIELD = "startedAt";

    private static final String FIELD_USER_ID = "userId";
    private static final String FIELD_TICKET_ID = "ticketId";
    private static final String FIELD_SOURCE = "source";
    private static final String FIELD_STARTED_AT = "startedAt";
    private static final String FIELD_ENDED_AT = "endedAt";
    private static final String FIELD_DURATION_SECONDS = "durationSeconds";
    private static final String FIELD_NOTES = "notes";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";

    private static final String AGG_TOTAL_DURATION = "totalDuration";
    private static final String AGG_DISTINCT_DAYS = "distinctDays";
    private static final String AGG_DAY_KEY = "dayKey";

    private static final List<String> SORTABLE_FIELDS = List.of(
            ID_FIELD,
            FIELD_STARTED_AT,
            FIELD_ENDED_AT,
            FIELD_DURATION_SECONDS,
            FIELD_CREATED_AT,
            FIELD_UPDATED_AT
    );

    public CustomTimeEntryRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public Query buildTimeEntryQuery(TimeEntryQueryFilter filter) {
        Query query = new Query();
        if (filter == null) {
            return query;
        }

        addCriteriaIfNotEmpty(query, FIELD_USER_ID, filter.getUserIds());
        addCriteriaIfNotEmpty(query, FIELD_TICKET_ID, filter.getTicketIds());
        addCriteriaIfNotEmpty(query, FIELD_SOURCE, filter.getSources());
        applyStartedAtRange(query, filter.getStartedFrom(), filter.getStartedTo());
        applySearch(query, filter.getSearch(), filter.getSearchTicketIds());

        if (Boolean.TRUE.equals(filter.getActiveOnly())) {
            query.addCriteria(Criteria.where(FIELD_ENDED_AT).is(null));
        }

        return query;
    }

    private void applySearch(Query query, String search, List<String> searchTicketIds) {
        boolean hasNotes = search != null && !search.isBlank();
        boolean hasTickets = searchTicketIds != null && !searchTicketIds.isEmpty();
        if (!hasNotes && !hasTickets) {
            return;
        }
        List<Criteria> branches = new ArrayList<>(2);
        if (hasNotes) {
            branches.add(Criteria.where(FIELD_NOTES).regex(search.trim(), "i"));
        }
        if (hasTickets) {
            branches.add(Criteria.where(FIELD_TICKET_ID).in(searchTicketIds));
        }
        query.addCriteria(branches.size() == 1
                ? branches.get(0)
                : new Criteria().orOperator(branches.toArray(Criteria[]::new)));
    }

    private void addCriteriaIfNotEmpty(Query query, String field, List<?> values) {
        if (values != null && !values.isEmpty()) {
            query.addCriteria(Criteria.where(field).in(values));
        }
    }

    private void applyStartedAtRange(Query query, Instant from, Instant to) {
        if (from == null && to == null) {
            return;
        }
        Criteria criteria = Criteria.where(FIELD_STARTED_AT);
        if (from != null) {
            criteria = criteria.gte(from);
        }
        if (to != null) {
            criteria = criteria.lt(to);
        }
        query.addCriteria(criteria);
    }

    @Override
    public List<TimeEntry> findTimeEntriesWithCursor(Query query, String cursor, int limit,
                                                      String sortField, String sortDirection) {
        boolean isDesc = SORT_DESC.equalsIgnoreCase(sortDirection);
        Sort.Direction direction = isDesc ? Sort.Direction.DESC : Sort.Direction.ASC;

        if (cursor != null && !cursor.trim().isEmpty()) {
            try {
                ObjectId cursorId = new ObjectId(cursor);
                applyCursorCriteria(query, cursorId, sortField, isDesc);
            } catch (IllegalArgumentException ex) {
                log.warn("Invalid ObjectId cursor format: {}", cursor);
            }
        }
        query.limit(limit);

        if (ID_FIELD.equals(sortField)) {
            query.with(Sort.by(direction, ID_FIELD));
        } else {
            query.with(Sort.by(
                    Sort.Order.by(sortField).with(direction),
                    Sort.Order.by(ID_FIELD).with(direction)
            ));
        }

        return mongoTemplate.find(query, TimeEntry.class);
    }

    private void applyCursorCriteria(Query query, ObjectId cursorId, String sortField, boolean isDesc) {
        if (ID_FIELD.equals(sortField)) {
            query.addCriteria(buildIdCriteria(cursorId, isDesc));
            return;
        }

        // Use findOne(Query) so TenantAwareMongoTemplate scopes the lookup to the current tenant —
        // findById(Object, Class) is NOT overridden and would leak across tenants.
        Query cursorLookup = new Query(Criteria.where(ID_FIELD).is(cursorId));
        TimeEntry cursorDoc = mongoTemplate.findOne(cursorLookup, TimeEntry.class);
        if (cursorDoc == null) {
            log.warn("Cursor document not found for id: {}", cursorId);
            query.addCriteria(buildIdCriteria(cursorId, isDesc));
            return;
        }

        Object cursorSortValue = getSortFieldValue(cursorDoc, sortField);
        if (cursorSortValue == null) {
            query.addCriteria(buildIdCriteria(cursorId, isDesc));
            return;
        }

        Criteria pastSortValue = isDesc
                ? Criteria.where(sortField).lt(cursorSortValue)
                : Criteria.where(sortField).gt(cursorSortValue);

        Criteria sameSortValuePastId = new Criteria().andOperator(
                Criteria.where(sortField).is(cursorSortValue),
                buildIdCriteria(cursorId, isDesc)
        );

        query.addCriteria(new Criteria().orOperator(pastSortValue, sameSortValuePastId));
    }

    private Criteria buildIdCriteria(ObjectId cursorId, boolean isDesc) {
        return isDesc
                ? Criteria.where(ID_FIELD).lt(cursorId)
                : Criteria.where(ID_FIELD).gt(cursorId);
    }

    private Object getSortFieldValue(TimeEntry entry, String sortField) {
        return switch (sortField) {
            case FIELD_STARTED_AT -> entry.getStartedAt();
            case FIELD_ENDED_AT -> entry.getEndedAt();
            case FIELD_DURATION_SECONDS -> entry.getDurationSeconds();
            case FIELD_CREATED_AT -> entry.getCreatedAt();
            case FIELD_UPDATED_AT -> entry.getUpdatedAt();
            default -> null;
        };
    }

    @Override
    public long countTimeEntries(Query query) {
        return mongoTemplate.count(query, TimeEntry.class);
    }

    @Override
    public long sumDurationSecondsByUser(String userId, Instant from, Instant to) {
        Criteria match = tenantCriteria()
                .and(FIELD_USER_ID).is(userId)
                .and(FIELD_ENDED_AT).ne(null)
                .and(FIELD_STARTED_AT).gte(from).lt(to);

        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(match),
                Aggregation.group().sum(FIELD_DURATION_SECONDS).as(AGG_TOTAL_DURATION)
        );

        Document result = mongoTemplate.aggregate(aggregation, TimeEntry.class, Document.class)
                .getUniqueMappedResult();
        if (result == null || result.get(AGG_TOTAL_DURATION) == null) {
            return 0L;
        }
        return ((Number) result.get(AGG_TOTAL_DURATION)).longValue();
    }

    @Override
    public long countCompletedEntriesByUser(String userId, Instant from, Instant to) {
        Query query = new Query(tenantCriteria()
                .and(FIELD_USER_ID).is(userId)
                .and(FIELD_ENDED_AT).ne(null)
                .and(FIELD_STARTED_AT).gte(from).lt(to));
        return mongoTemplate.count(query, TimeEntry.class);
    }

    @Override
    public long countDistinctActiveDaysByUser(String userId, Instant from, Instant to) {
        Criteria match = tenantCriteria()
                .and(FIELD_USER_ID).is(userId)
                .and(FIELD_ENDED_AT).ne(null)
                .and(FIELD_STARTED_AT).gte(from).lt(to);

        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(match),
                Aggregation.project()
                        .and(DateOperators.DateToString.dateOf(FIELD_STARTED_AT).toString("%Y-%m-%d"))
                        .as(AGG_DAY_KEY),
                Aggregation.group(AGG_DAY_KEY),
                Aggregation.count().as(AGG_DISTINCT_DAYS)
        );

        Document result = mongoTemplate.aggregate(aggregation, TimeEntry.class, Document.class)
                .getUniqueMappedResult();
        if (result == null || result.get(AGG_DISTINCT_DAYS) == null) {
            return 0L;
        }
        return ((Number) result.get(AGG_DISTINCT_DAYS)).longValue();
    }

    @Override
    public Map<String, Long> sumDurationSecondsByTicketIds(List<String> ticketIds) {
        Map<String, Long> totals = new HashMap<>();
        if (ticketIds == null || ticketIds.isEmpty()) {
            return totals;
        }
        for (String ticketId : ticketIds) {
            totals.put(ticketId, 0L);
        }

        Criteria match = tenantCriteria()
                .and(FIELD_TICKET_ID).in(ticketIds)
                .and(FIELD_ENDED_AT).ne(null);

        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(match),
                Aggregation.group(FIELD_TICKET_ID).sum(FIELD_DURATION_SECONDS).as(AGG_TOTAL_DURATION)
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, TimeEntry.class, Document.class);

        for (Document doc : results.getMappedResults()) {
            String ticketId = doc.getString(ID_FIELD);
            if (ticketId != null && doc.get(AGG_TOTAL_DURATION) != null) {
                totals.put(ticketId, ((Number) doc.get(AGG_TOTAL_DURATION)).longValue());
            }
        }
        return totals;
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field.trim());
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_FIELD;
    }
}
