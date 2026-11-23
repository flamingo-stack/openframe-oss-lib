package com.openframe.data.repository.assignment;

import com.openframe.core.exception.InvalidCursorException;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.TenantAwareRepositorySupport;
import com.openframe.data.repository.cursor.CursorPosition;
import com.openframe.data.repository.cursor.KeysetCursor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.util.StringUtils;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Slf4j
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class CustomItemAssignmentRepositoryImpl extends TenantAwareRepositorySupport implements CustomItemAssignmentRepository {

    private static final String FIELD_ITEM_ID = "itemId";
    private static final String FIELD_ITEM_TYPE = "itemType";
    private static final String FIELD_TARGET_TYPE = "targetType";
    private static final String FIELD_TARGET_ID = "targetId";
    private static final String FIELD_DISPLAY_NAME = "displayName";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String ID_FIELD = "_id";
    private static final String AGG_COUNT = "count";
    private static final String SORT_DESC = "DESC";
    private static final String NO_SORT_VALUE = "";

    private static final String DEFAULT_SORT_FIELD = FIELD_CREATED_AT;

    private static final List<String> SORTABLE_FIELDS = List.of(
            FIELD_CREATED_AT,
            FIELD_DISPLAY_NAME
    );

    public CustomItemAssignmentRepositoryImpl(TenantAwareMongoTemplate mongoTemplate) {
        super(mongoTemplate);
    }

    @Override
    public List<ItemAssignment> findAssignmentsWithCursor(String itemId, AssignmentTargetType targetType,
                                                          String search, String sortField, String sortDirection,
                                                          CursorPosition position, boolean backward, int limit) {
        Sort.Direction direction = directionOf(sortDirection);
        boolean fetchDescending = direction.isDescending() != backward;
        Query query = buildAssignmentQuery(itemId, targetType, search);
        keysetAnchor(position, sortField, direction)
                .map(anchor -> keysetCriteria(anchor, fetchDescending))
                .map(pastAnchor -> new Criteria().andOperator(pastAnchor))
                .ifPresent(query::addCriteria);
        Sort sort = sortWithIdTieBreak(sortField, fetchDescending);
        query.with(sort);
        query.limit(limit);

        return mongoTemplate.find(query, ItemAssignment.class);
    }

    @Override
    public KeysetCursor keysetCursor(ItemAssignment assignment, String sortField, String sortDirection) {
        Sort.Direction direction = directionOf(sortDirection);
        return keysetOf(assignment, sortField, direction);
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
            case CursorPosition.Unrecognised _ -> throw new InvalidCursorException();
        };
    }

    private KeysetCursor rowAnchor(String rowId, String sortField, Sort.Direction direction) {
        if (ID_FIELD.equals(sortField)) {
            return idAnchor(rowId, direction);
        }
        return cursorRow(rowId)
                .map(row -> keysetOf(row, sortField, direction))
                .orElseGet(() -> missingRowAnchor(rowId, sortField, direction));
    }

    private static KeysetCursor idAnchor(String rowId, Sort.Direction direction) {
        return new KeysetCursor(ID_FIELD, direction, NO_SORT_VALUE, rowId);
    }

    private static KeysetCursor missingRowAnchor(String rowId, String sortField, Sort.Direction direction) {
        if (FIELD_CREATED_AT.equals(sortField)) {
            return idAnchor(rowId, direction);
        }
        throw new InvalidCursorException();
    }

    private Optional<ItemAssignment> cursorRow(String rowId) {
        ObjectId id = cursorObjectId(rowId);
        Criteria byId = Criteria.where(ID_FIELD).is(id);
        Query query = new Query(byId);
        ItemAssignment row = mongoTemplate.findOne(query, ItemAssignment.class);
        return Optional.ofNullable(row);
    }

    private static KeysetCursor keysetOf(ItemAssignment assignment, String sortField, Sort.Direction direction) {
        String id = assignment.getId();
        return switch (sortField) {
            case FIELD_DISPLAY_NAME -> KeysetCursor.ofString(sortField, direction, assignment.getDisplayName(), id);
            case FIELD_CREATED_AT -> KeysetCursor.ofInstant(sortField, direction, assignment.getCreatedAt(), id);
            default -> new KeysetCursor(sortField, direction, NO_SORT_VALUE, id);
        };
    }

    private static Criteria keysetCriteria(KeysetCursor cursor, boolean fetchDescending) {
        String sortField = cursor.sortField();
        ObjectId cursorId = cursorObjectId(cursor.id());
        if (ID_FIELD.equals(sortField)) {
            Criteria id = Criteria.where(ID_FIELD);
            return pastId(id, cursorId, fetchDescending);
        }
        Object sortValue = FIELD_DISPLAY_NAME.equals(sortField) ? cursor.stringValue() : cursor.instantValue();
        if (sortValue == null) {
            return nullGroupKeyset(sortField, cursorId, fetchDescending);
        }
        return valueKeyset(sortField, sortValue, cursorId, fetchDescending);
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
    public long countAssignments(String itemId, AssignmentTargetType targetType, String search) {
        Query query = buildAssignmentQuery(itemId, targetType, search);
        return mongoTemplate.count(query, ItemAssignment.class);
    }

    private Query buildAssignmentQuery(String itemId, AssignmentTargetType targetType, String search) {
        Query query = new Query();
        query.addCriteria(Criteria.where(FIELD_ITEM_ID).is(itemId));
        query.addCriteria(Criteria.where(FIELD_TARGET_TYPE).is(targetType));

        if (StringUtils.hasText(search)) {
            query.addCriteria(Criteria.where(FIELD_DISPLAY_NAME).regex(Pattern.quote(search.trim()), "i"));
        }

        return query;
    }

    @Override
    public Map<AssignmentTargetType, Long> countByItemIdGroupedByTargetType(String itemId) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(tenantCriteria().and(FIELD_ITEM_ID).is(itemId)),
                Aggregation.group(FIELD_TARGET_TYPE).count().as(AGG_COUNT),
                Aggregation.project(AGG_COUNT).and(ID_FIELD).as(FIELD_TARGET_TYPE)
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, ItemAssignment.class, Document.class);

        Map<AssignmentTargetType, Long> counts = new EnumMap<>(AssignmentTargetType.class);
        for (Document doc : results.getMappedResults()) {
            String typeStr = doc.getString(FIELD_TARGET_TYPE);
            if (typeStr != null) {
                try {
                    AssignmentTargetType type = AssignmentTargetType.valueOf(typeStr);
                    counts.put(type, doc.getInteger(AGG_COUNT).longValue());
                } catch (IllegalArgumentException e) {
                    log.warn("Unknown assignment target type: {}", typeStr);
                }
            }
        }

        return counts;
    }

    @Override
    public List<String> findItemIdsByTarget(AssignmentItemType itemType, AssignmentTargetType targetType,
                                            String targetId) {
        Query query = new Query();
        query.addCriteria(Criteria.where(FIELD_TARGET_TYPE).is(targetType));
        query.addCriteria(Criteria.where(FIELD_TARGET_ID).is(targetId));
        query.addCriteria(Criteria.where(FIELD_ITEM_TYPE).is(itemType));
        query.fields().include(FIELD_ITEM_ID);

        return mongoTemplate.find(query, ItemAssignment.class).stream()
                .map(ItemAssignment::getItemId)
                .toList();
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
