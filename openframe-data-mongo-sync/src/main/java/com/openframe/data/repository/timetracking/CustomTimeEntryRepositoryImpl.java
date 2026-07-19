package com.openframe.data.repository.timetracking;

import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.filter.TimeEntryQueryFilter;
import com.openframe.data.document.timetracking.filter.TimeEntryStateFilter;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomTimeEntryRepositoryImpl extends TenantAwareRepositorySupport implements CustomTimeEntryRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String CURSOR_SEPARATOR = "_";
    private static final String DATE_FIELD = "date";
    private static final String WORK_DAY_FIELD = "_workDay";
    private static final String DAY_KEY_FORMAT = "%Y-%m-%d";
    private static final String DEFAULT_SORT_FIELD = DATE_FIELD;

    private static final String FIELD_USER_ID = "userId";
    private static final String FIELD_TICKET_ID = "ticketId";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_SOURCE = "source";
    private static final String FIELD_STARTED_AT = "startedAt";
    private static final String FIELD_ENDED_AT = "endedAt";
    private static final String FIELD_DURATION_SECONDS = "durationSeconds";
    private static final String FIELD_NOTES = "notes";
    private static final String FIELD_TICKET_NUMBER = "ticketNumber";
    private static final String FIELD_TICKET_TITLE = "ticketTitle";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";

    private static final String AGG_TOTAL_DURATION = "totalDuration";
    private static final String AGG_DISTINCT_DAYS = "distinctDays";
    private static final String AGG_DAY_KEY = "dayKey";

    private static final List<String> SORTABLE_FIELDS = List.of(
            ID_FIELD,
            DATE_FIELD,
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
        addCriteriaIfNotEmpty(query, FIELD_ORGANIZATION_ID, filter.getOrganizationIds());
        addCriteriaIfNotEmpty(query, FIELD_SOURCE, filter.getSources());
        applyStartedAtRange(query, filter.getStartedFrom(), filter.getStartedTo());
        applySearch(query, filter.getSearch());

        if (filter.getState() != null) {
            switch (filter.getState()) {
                case ACTIVE -> query.addCriteria(Criteria.where(FIELD_ENDED_AT).is(null));
                case COMPLETED -> query.addCriteria(Criteria.where(FIELD_ENDED_AT).ne(null));
            }
        }

        return query;
    }

    private void applySearch(Query query, String search) {
        if (search == null || search.isBlank()) {
            return;
        }
        String trimmed = search.trim();
        String quoted = Pattern.quote(trimmed);
        List<Criteria> branches = new ArrayList<>(3);
        branches.add(Criteria.where(FIELD_NOTES).regex(quoted, "i"));
        branches.add(Criteria.where(FIELD_TICKET_TITLE).regex(quoted, "i"));
        try {
            branches.add(Criteria.where(FIELD_TICKET_NUMBER).is(Integer.parseInt(trimmed)));
        } catch (NumberFormatException ignored) {
        }
        query.addCriteria(new Criteria().orOperator(branches.toArray(Criteria[]::new)));
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

        if (DATE_FIELD.equals(sortField)) {
            return findWithDateSort(query, cursor, limit, isDesc);
        }

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

    /**
     * Composite sort by (dayKey(startedAt), createdAt, _id). Groups entries by the calendar day
     * of their startedAt so a manually added entry (startedAt at midnight) sits at the top of
     * its date group by insertion time, while backdated entries stay grouped with other entries
     * of their own day rather than jumping to the top of the list.
     */
    private List<TimeEntry> findWithDateSort(Query query, String cursor, int limit, boolean isDesc) {
        Sort.Direction direction = isDesc ? Sort.Direction.DESC : Sort.Direction.ASC;

        List<AggregationOperation> stages = new ArrayList<>();
        stages.add(Aggregation.match(tenantCriteria()));
        Document filterDoc = query.getQueryObject();
        if (!filterDoc.isEmpty()) {
            stages.add(context -> new Document("$match", context.getMappedObject(filterDoc, TimeEntry.class)));
        }
        stages.add(Aggregation.addFields()
                .addFieldWithValueOf(WORK_DAY_FIELD,
                        DateOperators.DateToString.dateOf(FIELD_STARTED_AT).toString(DAY_KEY_FORMAT))
                .build());

        if (cursor != null && !cursor.trim().isEmpty()) {
            applyDateCursor(stages, cursor, isDesc);
        }

        stages.add(Aggregation.sort(Sort.by(
                Sort.Order.by(WORK_DAY_FIELD).with(direction),
                Sort.Order.by(FIELD_CREATED_AT).with(direction),
                Sort.Order.by(ID_FIELD).with(direction)
        )));
        stages.add(Aggregation.limit(limit));

        return mongoTemplate.aggregate(
                Aggregation.newAggregation(stages), TimeEntry.class, TimeEntry.class
        ).getMappedResults();
    }

    /**
     * Keyset predicate for the compound {@code (workDay, createdAt, _id)} sort. The cursor encodes
     * {@code "dayKey_createdAtMillis_objectId"}; the comparison operator must match the active
     * direction so paging stays consistent — DESC pages toward older days ({@code <}), ASC
     * toward newer ({@code >}). Tie-breakers on {@code createdAt} and {@code _id} use the same
     * operator as the sort. Follows the pattern in CustomOrganizationRepositoryImpl.
     */
    private void applyDateCursor(List<AggregationOperation> stages, String cursor, boolean isDesc) {
        String[] parts = cursor.split(CURSOR_SEPARATOR, 3);
        if (parts.length != 3) {
            log.warn("Invalid compound cursor format: {}", cursor);
            return;
        }
        try {
            String cursorDay = parts[0];
            Instant cursorCreated = Instant.ofEpochMilli(Long.parseLong(parts[1]));
            ObjectId cursorId = new ObjectId(parts[2]);

            Criteria pastDay = isDesc
                    ? Criteria.where(WORK_DAY_FIELD).lt(cursorDay)
                    : Criteria.where(WORK_DAY_FIELD).gt(cursorDay);
            Criteria sameDayPastCreated = new Criteria().andOperator(
                    Criteria.where(WORK_DAY_FIELD).is(cursorDay),
                    isDesc ? Criteria.where(FIELD_CREATED_AT).lt(cursorCreated)
                           : Criteria.where(FIELD_CREATED_AT).gt(cursorCreated)
            );
            Criteria sameDayCreatedPastId = new Criteria().andOperator(
                    Criteria.where(WORK_DAY_FIELD).is(cursorDay),
                    Criteria.where(FIELD_CREATED_AT).is(cursorCreated),
                    isDesc ? Criteria.where(ID_FIELD).lt(cursorId)
                           : Criteria.where(ID_FIELD).gt(cursorId)
            );

            stages.add(Aggregation.match(new Criteria().orOperator(
                    pastDay, sameDayPastCreated, sameDayCreatedPastId
            )));
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid compound cursor format: {}", cursor);
        }
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
    public long sumDurationSeconds(List<String> userIds, List<String> organizationIds, Instant from, Instant to) {
        Criteria match = buildStatsMatchCriteria(userIds, organizationIds, from, to);

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
    public long countCompletedEntries(List<String> userIds, List<String> organizationIds, Instant from, Instant to) {
        Criteria criteria = buildStatsMatchCriteria(userIds, organizationIds, from, to);
        return mongoTemplate.count(new Query(criteria), TimeEntry.class);
    }

    @Override
    public long countDistinctActiveDays(List<String> userIds, List<String> organizationIds, Instant from, Instant to) {
        Criteria match = buildStatsMatchCriteria(userIds, organizationIds, from, to);

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

    private Criteria buildStatsMatchCriteria(List<String> userIds, List<String> organizationIds,
                                             Instant from, Instant to) {
        Criteria match = tenantCriteria().and(FIELD_ENDED_AT).ne(null);
        if (userIds != null && !userIds.isEmpty()) {
            match = match.and(FIELD_USER_ID).in(userIds);
        }
        if (organizationIds != null && !organizationIds.isEmpty()) {
            match = match.and(FIELD_ORGANIZATION_ID).in(organizationIds);
        }
        if (from != null && to != null) {
            match = match.and(FIELD_STARTED_AT).gte(from).lt(to);
        }
        return match;
    }
}
