package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

/**
 * MongoTemplate-backed implementation of {@link CustomScriptScheduleRepository}.
 *
 * <p>Cursor pagination is a keyset over the active sort: plain {@code _id} when sorting by
 * {@code _id} (the default, descending), otherwise a compound {@code (sortField, _id)}
 * cursor — required because sort values repeat (many schedules share a {@code repeat}
 * interval) and an {@code _id}-only cursor would skip and duplicate rows across a tie
 * boundary. The comparison is flipped when paginating backward. All queries are
 * tenant-scoped. An invalid cursor is logged and treated as "no cursor" (first page).
 */
@Slf4j
@Repository
@RequiredArgsConstructor
public class CustomScriptScheduleRepositoryImpl implements CustomScriptScheduleRepository {

    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_NAME = "name";
    private static final String FIELD_SUPPORTED_PLATFORMS = "supportedPlatforms";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String FIELD_CREATED_BY = "createdBy";
    private static final String FIELD_COUNT = "count";
    private static final String FIELD_REPEAT = "repeat";
    private static final String FIELD_DEVICE_COUNT = "deviceCount";
    private static final String CURSOR_SEPARATOR = "|";

    /** Sort-field allowlist. Anything not in here falls back to {@link #getDefaultSortField()}. */
    private static final Set<String> SORTABLE_FIELDS =
            Set.of(FIELD_ID, FIELD_NAME, FIELD_CREATED_AT, FIELD_UPDATED_AT, FIELD_REPEAT, FIELD_DEVICE_COUNT);

    private final MongoTemplate mongoTemplate;

    @Override
    public List<ScriptSchedule> findPageForTenant(String tenantId,
                                                  ScriptScheduleQueryFilter filter,
                                                  String search,
                                                  String sortField,
                                                  Sort.Direction sortDirection,
                                                  String cursor,
                                                  boolean backward,
                                                  int limit) {
        Criteria criteria = buildBaseCriteria(tenantId, filter, search);

        Sort.Direction effectiveDir = backward ? flip(sortDirection) : sortDirection;
        applyCursor(criteria, cursor, effectiveDir, sortField);

        Query query = new Query(criteria)
                .with(sortWithIdTiebreaker(effectiveDir, sortField))
                .limit(limit);

        return mongoTemplate.find(query, ScriptSchedule.class);
    }

    @Override
    public long countForTenant(String tenantId, ScriptScheduleQueryFilter filter, String search) {
        Query query = new Query(buildBaseCriteria(tenantId, filter, search));
        return mongoTemplate.count(query, ScriptSchedule.class);
    }

    /**
     * Build the shared tenant + filter + search predicate (no cursor, no sort,
     * no limit) used by both the page fetch and the count.
     */
    private Criteria buildBaseCriteria(String tenantId, ScriptScheduleQueryFilter filter, String search) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        applyStatusFilter(criteria, filter);
        applyPlatformsFilter(criteria, filter);
        applyCreatedByFilter(criteria, filter);
        applySearch(criteria, search);
        return criteria;
    }

    @Override
    public Map<String, Integer> platformFacet(String tenantId, ScriptScheduleQueryFilter filter) {
        return facetCounts(facetCriteria(tenantId, filter, FIELD_SUPPORTED_PLATFORMS), FIELD_SUPPORTED_PLATFORMS, true);
    }

    @Override
    public Map<String, Integer> authorFacet(String tenantId, ScriptScheduleQueryFilter filter) {
        return facetCounts(facetCriteria(tenantId, filter, FIELD_CREATED_BY), FIELD_CREATED_BY, false);
    }

    /**
     * Tenant + filter predicate for a facet query: the same constraints as the
     * list (incl. the default DELETED-exclusion), EXCEPT the facet's own field
     * is dropped — so its dropdown still offers every switchable value.
     */
    private Criteria facetCriteria(String tenantId, ScriptScheduleQueryFilter filter, String excludeField) {
        Criteria criteria = Criteria.where(FIELD_TENANT_ID).is(tenantId);
        applyStatusFilter(criteria, filter);
        if (!FIELD_SUPPORTED_PLATFORMS.equals(excludeField)) {
            applyPlatformsFilter(criteria, filter);
        }
        if (!FIELD_CREATED_BY.equals(excludeField)) {
            applyCreatedByFilter(criteria, filter);
        }
        return criteria;
    }

    /** {@code match → [unwind] → group(field).count()} → {value → count}; null values are dropped. */
    private Map<String, Integer> facetCounts(Criteria match, String groupField, boolean unwind) {
        List<AggregationOperation> ops = new ArrayList<>();
        ops.add(Aggregation.match(match));
        if (unwind) {
            ops.add(Aggregation.unwind(groupField));
        }
        ops.add(Aggregation.group(groupField).count().as(FIELD_COUNT));
        AggregationResults<Document> results =
                mongoTemplate.aggregate(Aggregation.newAggregation(ops), ScriptSchedule.class, Document.class);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Document doc : results.getMappedResults()) {
            Object value = doc.get(FIELD_ID);
            if (value == null) {
                continue;
            }
            counts.put(value.toString(), ((Number) doc.get(FIELD_COUNT)).intValue());
        }
        return counts;
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field);
    }

    @Override
    public String getDefaultSortField() {
        return FIELD_ID;
    }

    private static void applyStatusFilter(Criteria criteria, ScriptScheduleQueryFilter filter) {
        if (filter != null && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
            criteria.and(FIELD_STATUS).in(filter.getStatuses());
        } else {
            // Default: hide soft-deleted schedules ({@code $ne} also covers legacy null status).
            criteria.and(FIELD_STATUS).ne(ScriptStatus.DELETED);
        }
    }

    private static void applyPlatformsFilter(Criteria criteria, ScriptScheduleQueryFilter filter) {
        if (filter != null && filter.getSupportedPlatforms() != null && !filter.getSupportedPlatforms().isEmpty()) {
            criteria.and(FIELD_SUPPORTED_PLATFORMS).in(filter.getSupportedPlatforms());
        }
    }

    private static void applyCreatedByFilter(Criteria criteria, ScriptScheduleQueryFilter filter) {
        if (filter != null && filter.getCreatedByIds() != null && !filter.getCreatedByIds().isEmpty()) {
            criteria.and(FIELD_CREATED_BY).in(filter.getCreatedByIds());
        }
    }

    private static void applySearch(Criteria criteria, String search) {
        if (isBlank(search)) {
            return;
        }
        criteria.and(FIELD_NAME).regex(Pattern.quote(search.trim()), "i");
    }

    /**
     * Keyset predicate matching the active sort. {@code effectiveDir} already folds in
     * backward paging (forward+DESC and backward+ASC both walk "downward"), so the
     * comparison operator follows it directly.
     */
    private static void applyCursor(Criteria criteria, String cursor, Sort.Direction effectiveDir, String sortField) {
        if (isBlank(cursor)) {
            return;
        }
        if (FIELD_ID.equals(sortField)) {
            applyIdCursor(criteria, cursor, effectiveDir);
            return;
        }
        applyCompoundCursor(criteria, cursor, effectiveDir, sortField);
    }

    private static void applyIdCursor(Criteria criteria, String cursor, Sort.Direction effectiveDir) {
        ObjectId cursorId = parseObjectId(cursor);
        if (cursorId == null) {
            return;
        }
        if (effectiveDir == Sort.Direction.DESC) {
            criteria.and(FIELD_ID).lt(cursorId);
        } else {
            criteria.and(FIELD_ID).gt(cursorId);
        }
    }

    /**
     * Compound keyset over {@code (sortField, _id)} — the only correct way to page a sort
     * whose values repeat (a handful of distinct {@code repeat} intervals across the whole
     * list). Sorting on the value alone with an {@code _id}-only cursor silently skips and
     * repeats rows across a tie boundary.
     *
     * <p>Nulls need explicit handling: MongoDB's range operators never match {@code null}
     * (a number-bracket {@code $lt} skips it), while BSON ordering puts null <b>before</b>
     * numbers. So ASC must additionally sweep in every non-null row once the null group is
     * exhausted, and DESC must append the null tail that sorts after every value.
     */
    private static void applyCompoundCursor(Criteria criteria, String cursor,
                                            Sort.Direction effectiveDir, String sortField) {
        int separator = cursor.lastIndexOf(CURSOR_SEPARATOR);
        if (separator < 0) {
            log.warn("Invalid compound cursor (no separator) for schedule pagination: '{}' — falling back to first page", cursor);
            return;
        }
        ObjectId cursorId = parseObjectId(cursor.substring(separator + 1));
        if (cursorId == null) {
            return;
        }

        Object value;
        try {
            value = parseSortValue(cursor.substring(0, separator), sortField);
        } catch (RuntimeException ex) {
            log.warn("Unparseable '{}' value in schedule cursor '{}' — falling back to first page", sortField, cursor);
            return;
        }

        boolean ascending = effectiveDir == Sort.Direction.ASC;
        List<Document> or = new ArrayList<>();

        if (value == null) {
            // Cursor sits inside the null group: continue it by _id...
            or.add(tieBreak(sortField, null, cursorId, ascending));
            if (ascending) {
                // ...and, ascending, everything non-null still lies ahead.
                or.add(Criteria.where(sortField).ne(null).getCriteriaObject());
            }
        } else {
            or.add(ascending
                    ? Criteria.where(sortField).gt(value).getCriteriaObject()
                    : Criteria.where(sortField).lt(value).getCriteriaObject());
            or.add(tieBreak(sortField, value, cursorId, ascending));
            if (!ascending) {
                // Descending, the null tail sorts after every value — none of it seen yet.
                or.add(Criteria.where(sortField).is(null).getCriteriaObject());
            }
        }

        // $or as an explicit key: a second keyless criteria would clash with the base
        // filter's chained predicate (MongoDB Query rejects it). Mirrors CustomOrganizationRepositoryImpl.
        criteria.and("$or").is(or);
    }

    /** {@code {sortField: value, _id: {$gt|$lt: cursorId}}} — same sort value, next id. */
    private static Document tieBreak(String sortField, Object value, ObjectId cursorId, boolean ascending) {
        Criteria sameValue = Criteria.where(sortField).is(value);
        return (ascending ? sameValue.and(FIELD_ID).gt(cursorId) : sameValue.and(FIELD_ID).lt(cursorId))
                .getCriteriaObject();
    }

    private static ObjectId parseObjectId(String raw) {
        try {
            return new ObjectId(raw);
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid ObjectId in schedule cursor: '{}' — falling back to first page", raw);
            return null;
        }
    }

    /** Empty means "the row's sort value was null" (see {@link #encodeSortValue}). */
    private static Object parseSortValue(String raw, String sortField) {
        if (raw.isEmpty()) {
            return null;
        }
        return switch (sortField) {
            case FIELD_REPEAT -> Long.parseLong(raw);
            case FIELD_DEVICE_COUNT -> Integer.parseInt(raw);
            case FIELD_CREATED_AT, FIELD_UPDATED_AT -> Date.from(Instant.ofEpochMilli(Long.parseLong(raw)));
            default -> raw;
        };
    }

    @Override
    public String encodeCursor(ScriptSchedule schedule, String sortField) {
        if (schedule == null) {
            return null;
        }
        if (FIELD_ID.equals(sortField)) {
            return schedule.getId();
        }
        return encodeSortValue(schedule, sortField) + CURSOR_SEPARATOR + schedule.getId();
    }

    /**
     * Sort value as a string, empty for null. Parsed back by {@link #parseSortValue}; the
     * separator is located from the right, so a value containing it (a schedule name) is
     * still split correctly against the fixed-length ObjectId.
     */
    private static String encodeSortValue(ScriptSchedule schedule, String sortField) {
        Object value = switch (sortField) {
            case FIELD_NAME -> schedule.getName();
            case FIELD_CREATED_AT -> schedule.getCreatedAt();
            case FIELD_UPDATED_AT -> schedule.getUpdatedAt();
            case FIELD_REPEAT -> schedule.getRepeat();
            case FIELD_DEVICE_COUNT -> schedule.getDeviceCount();
            default -> null;
        };
        if (value == null) {
            return "";
        }
        if (value instanceof Instant instant) {
            return String.valueOf(instant.toEpochMilli());
        }
        return String.valueOf(value);
    }

    private static Sort.Direction flip(Sort.Direction direction) {
        return direction == Sort.Direction.ASC ? Sort.Direction.DESC : Sort.Direction.ASC;
    }

    /**
     * Sort by the requested field with {@code _id} as a tie-breaker, so rows sharing a
     * sort value (very common for {@code repeat} — a handful of distinct intervals across
     * the whole list) come back in a stable, repeatable order instead of Mongo's arbitrary
     * one. Redundant when already sorting by {@code _id}.
     *
     * <p>Note: the cursor predicate is still {@code _id}-only, so deep paging across a tie
     * boundary on a non-{@code _id} sort can skip/repeat rows. Pre-existing for
     * name/createdAt/updatedAt; a compound keyset cursor is the proper fix.
     */
    private static Sort sortWithIdTiebreaker(Sort.Direction direction, String sortField) {
        if (FIELD_ID.equals(sortField)) {
            return Sort.by(direction, FIELD_ID);
        }
        return Sort.by(direction, sortField).and(Sort.by(direction, FIELD_ID));
    }
}
