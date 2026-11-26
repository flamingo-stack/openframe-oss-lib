package com.openframe.data.repository.timetracking;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.document.timetracking.filter.TimeEntryQueryFilter;
import com.openframe.data.document.timetracking.filter.TimeEntryStateFilter;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.aggregation.DateOperators;
import org.springframework.data.mongodb.core.query.BasicQuery;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomTimeEntryRepositoryImpl extends TenantAwareRepositorySupport implements CustomTimeEntryRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String AND_OPERATOR = "$and";
    private static final String NO_SORT_VALUE = "";
    private static final String DATE_VALUE_SEPARATOR = "_";
    private static final String DATE_FIELD = "date";
    private static final String WORK_DAY_FIELD = "_workDay";
    private static final String DAY_KEY_FORMAT = "%Y-%m-%d";
    private static final String NO_DAY_KEY = "0000-00-00";
    private static final Pattern DAY_KEY = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
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
    public List<TimeEntry> findTimeEntriesWithCursor(Query query, CursorPosition position, boolean backward, int limit,
                                                      String sortField, String sortDirection) {
        Sort.Direction direction = directionOf(sortDirection);
        boolean fetchDescending = direction.isDescending() != backward;
        Optional<Criteria> pastAnchor = keysetAnchor(position, sortField, direction)
                .map(anchor -> keysetCriteria(anchor, sortField, fetchDescending));

        if (DATE_FIELD.equals(sortField)) {
            return findWithDateSort(query, pastAnchor, limit, fetchDescending);
        }

        Query pageQuery = pastAnchor
                .map(cursorBound -> withCursorBound(query, cursorBound))
                .orElse(query);
        Sort sort = sortWithIdTieBreak(sortField, fetchDescending);
        pageQuery.limit(limit);
        pageQuery.with(sort);

        return mongoTemplate.find(pageQuery, TimeEntry.class);
    }

    @Override
    public KeysetCursor keysetCursor(TimeEntry entry, String sortField, String sortDirection) {
        Sort.Direction direction = directionOf(sortDirection);
        return keysetOf(entry, sortField, direction);
    }

    /**
     * Composite sort by (dayKey(startedAt), createdAt, _id). Groups entries by the calendar day
     * of their startedAt so a manually added entry (startedAt at midnight) sits at the top of
     * its date group by insertion time, while backdated entries stay grouped with other entries
     * of their own day rather than jumping to the top of the list.
     */
    private List<TimeEntry> findWithDateSort(Query query, Optional<Criteria> pastAnchor, int limit,
                                             boolean fetchDescending) {
        Sort.Direction fetchDirection = fetchDescending ? Sort.Direction.DESC : Sort.Direction.ASC;

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

        pastAnchor.map(Aggregation::match).ifPresent(stages::add);

        stages.add(Aggregation.sort(Sort.by(
                Sort.Order.by(WORK_DAY_FIELD).with(fetchDirection),
                Sort.Order.by(FIELD_CREATED_AT).with(fetchDirection),
                Sort.Order.by(ID_FIELD).with(fetchDirection)
        )));
        stages.add(Aggregation.limit(limit));

        return mongoTemplate.aggregate(
                Aggregation.newAggregation(stages), TimeEntry.class, TimeEntry.class
        ).getMappedResults();
    }

    private static Sort.Direction directionOf(String sortDirection) {
        return SORT_DESC.equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
    }

    private static Sort sortWithIdTieBreak(String sortField, boolean fetchDescending) {
        Sort.Direction fetchDirection = fetchDescending ? Sort.Direction.DESC : Sort.Direction.ASC;
        Sort byId = Sort.by(fetchDirection, ID_FIELD);
        if (ID_FIELD.equals(sortField)) {
            return byId;
        }
        return Sort.by(fetchDirection, sortField).and(byId);
    }

    private static Query withCursorBound(Query base, Criteria cursorCriteria) {
        Document baseQuery = base.getQueryObject();
        Document merged = new Document(baseQuery);
        List<Object> conjuncts = new ArrayList<>();
        Object existing = merged.get(AND_OPERATOR);
        if (existing instanceof List<?> existingConjuncts) {
            conjuncts.addAll(existingConjuncts);
        }
        Document cursorBound = cursorCriteria.getCriteriaObject();
        conjuncts.add(cursorBound);
        merged.put(AND_OPERATOR, conjuncts);
        Document fields = base.getFieldsObject();
        return new BasicQuery(merged, fields);
    }

    private Optional<KeysetCursor> keysetAnchor(CursorPosition position, String sortField, Sort.Direction direction) {
        return switch (position) {
            case CursorPosition.None _ -> Optional.empty();
            case KeysetCursor keyset -> {
                keyset.requireSort(sortField, direction);
                yield Optional.of(keyset);
            }
            case CursorPosition.RowId rowId -> {
                KeysetCursor anchor = rowAnchor(rowId.id(), sortField, direction);
                yield Optional.of(anchor);
            }
            case CursorPosition.Unrecognised unrecognised -> {
                KeysetCursor anchor = olderDateAnchor(unrecognised.decoded(), sortField, direction);
                yield Optional.of(anchor);
            }
        };
    }

    private KeysetCursor rowAnchor(String rowId, String sortField, Sort.Direction direction) {
        if (ID_FIELD.equals(sortField)) {
            return new KeysetCursor(ID_FIELD, direction, NO_SORT_VALUE, rowId);
        }
        TimeEntry row = cursorRow(rowId);
        return keysetOf(row, sortField, direction);
    }

    private TimeEntry cursorRow(String rowId) {
        ObjectId id = cursorObjectId(rowId);
        Criteria byId = Criteria.where(ID_FIELD).is(id);
        Query query = new Query(byId);
        TimeEntry row = mongoTemplate.findOne(query, TimeEntry.class);
        if (row == null) {
            throw new InvalidCursorException();
        }
        return row;
    }

    private static KeysetCursor olderDateAnchor(String dayCreatedAtAndId, String sortField, Sort.Direction direction) {
        int idStart = dayCreatedAtAndId.lastIndexOf(DATE_VALUE_SEPARATOR);
        if (!DATE_FIELD.equals(sortField) || idStart < 0) {
            throw new InvalidCursorException();
        }
        String dayAndCreatedAt = dayCreatedAtAndId.substring(0, idStart);
        String id = dayCreatedAtAndId.substring(idStart + 1);
        try {
            return new KeysetCursor(DATE_FIELD, direction, dayAndCreatedAt, id);
        } catch (IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
    }

    private static KeysetCursor keysetOf(TimeEntry entry, String sortField, Sort.Direction direction) {
        String id = entry.getId();
        return switch (sortField) {
            case DATE_FIELD -> {
                String dayAndCreatedAt = dayAndCreatedAt(entry);
                yield new KeysetCursor(sortField, direction, dayAndCreatedAt, id);
            }
            case FIELD_STARTED_AT -> KeysetCursor.ofInstant(sortField, direction, entry.getStartedAt(), id);
            case FIELD_ENDED_AT -> KeysetCursor.ofInstant(sortField, direction, entry.getEndedAt(), id);
            case FIELD_CREATED_AT -> KeysetCursor.ofInstant(sortField, direction, entry.getCreatedAt(), id);
            case FIELD_UPDATED_AT -> KeysetCursor.ofInstant(sortField, direction, entry.getUpdatedAt(), id);
            case FIELD_DURATION_SECONDS -> {
                String durationSeconds = Long.toString(entry.getDurationSeconds());
                yield new KeysetCursor(sortField, direction, durationSeconds, id);
            }
            default -> new KeysetCursor(sortField, direction, NO_SORT_VALUE, id);
        };
    }

    private static String dayAndCreatedAt(TimeEntry entry) {
        Instant startedAt = entry.getStartedAt();
        Instant createdAt = entry.getCreatedAt();
        String dayKey = startedAt != null ? LocalDate.ofInstant(startedAt, ZoneOffset.UTC).toString() : NO_DAY_KEY;
        long createdAtMillis = createdAt != null ? createdAt.toEpochMilli() : 0L;
        return dayKey + DATE_VALUE_SEPARATOR + createdAtMillis;
    }

    private static Criteria keysetCriteria(KeysetCursor cursor, String sortField, boolean fetchDescending) {
        ObjectId cursorId = cursorObjectId(cursor.id());
        if (ID_FIELD.equals(sortField)) {
            Criteria id = Criteria.where(ID_FIELD);
            return pastId(id, cursorId, fetchDescending);
        }
        if (DATE_FIELD.equals(sortField)) {
            return dateKeyset(cursor.rawValue(), cursorId, fetchDescending);
        }
        Object sortValue = FIELD_DURATION_SECONDS.equals(sortField) ? durationValue(cursor) : cursor.instantValue();
        if (sortValue == null) {
            return nullGroupKeyset(sortField, cursorId, fetchDescending);
        }
        return valueKeyset(sortField, sortValue, cursorId, fetchDescending);
    }

    private static Long durationValue(KeysetCursor cursor) {
        if (cursor.hasNullValue()) {
            return null;
        }
        String durationSeconds = cursor.rawValue();
        return numberOf(durationSeconds);
    }

    private static long numberOf(String digits) {
        try {
            return Long.parseLong(digits);
        } catch (NumberFormatException e) {
            throw new InvalidCursorException(e);
        }
    }

    /**
     * Keyset predicate for the compound {@code (workDay, createdAt, _id)} sort. The position carries
     * {@code "dayKey_createdAtMillis"} and the id; the comparison operator follows the fetch direction
     * so paging stays consistent: descending moves toward older days ({@code <}), ascending toward
     * newer ({@code >}). Tie-breakers on {@code createdAt} and {@code _id} use the same operator as the sort.
     */
    private static Criteria dateKeyset(String dayAndCreatedAt, ObjectId cursorId, boolean fetchDescending) {
        String[] parts = dayAndCreatedAt.split(DATE_VALUE_SEPARATOR, 2);
        if (parts.length != 2 || !DAY_KEY.matcher(parts[0]).matches()) {
            throw new InvalidCursorException();
        }
        String cursorDay = parts[0];
        long createdAtMillis = numberOf(parts[1]);
        Instant cursorCreated = Instant.ofEpochMilli(createdAtMillis);

        Criteria day = Criteria.where(WORK_DAY_FIELD);
        Criteria pastDay = fetchDescending ? day.lt(cursorDay) : day.gt(cursorDay);
        Criteria created = Criteria.where(FIELD_CREATED_AT);
        Criteria pastCreated = fetchDescending ? created.lt(cursorCreated) : created.gt(cursorCreated);
        Criteria id = Criteria.where(ID_FIELD);
        Criteria pastCursorId = pastId(id, cursorId, fetchDescending);
        Criteria sameDay = Criteria.where(WORK_DAY_FIELD).is(cursorDay);
        Criteria sameCreated = Criteria.where(FIELD_CREATED_AT).is(cursorCreated);
        Criteria sameDayPastCreated = new Criteria().andOperator(sameDay, pastCreated);
        Criteria sameDayCreatedPastId = new Criteria().andOperator(sameDay, sameCreated, pastCursorId);

        return new Criteria().orOperator(pastDay, sameDayPastCreated, sameDayCreatedPastId);
    }

    private static Criteria nullGroupKeyset(String sortField, ObjectId cursorId, boolean fetchDescending) {
        Criteria idInsideNullGroup = Criteria.where(sortField).is(null).and(ID_FIELD);
        Criteria restOfNullGroup = pastId(idInsideNullGroup, cursorId, fetchDescending);
        if (fetchDescending) {
            return restOfNullGroup;
        }
        Criteria everyValue = Criteria.where(sortField).ne(null);
        return new Criteria().orOperator(restOfNullGroup, everyValue);
    }

    private static Criteria valueKeyset(String sortField, Object sortValue, ObjectId cursorId, boolean fetchDescending) {
        Criteria value = Criteria.where(sortField);
        Criteria pastValue = fetchDescending ? value.lt(sortValue) : value.gt(sortValue);
        Criteria idInsideSameValue = Criteria.where(sortField).is(sortValue).and(ID_FIELD);
        Criteria sameValuePastId = pastId(idInsideSameValue, cursorId, fetchDescending);
        if (fetchDescending) {
            Criteria nullGroup = Criteria.where(sortField).is(null);
            return new Criteria().orOperator(pastValue, sameValuePastId, nullGroup);
        }
        return new Criteria().orOperator(pastValue, sameValuePastId);
    }

    private static Criteria pastId(Criteria id, ObjectId cursorId, boolean fetchDescending) {
        return fetchDescending ? id.lt(cursorId) : id.gt(cursorId);
    }

    private static ObjectId cursorObjectId(String value) {
        if (!ObjectId.isValid(value)) {
            throw new InvalidCursorException();
        }
        return new ObjectId(value);
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
