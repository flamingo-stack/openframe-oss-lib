package com.openframe.data.repository.assignment;

import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Slf4j
public class CustomItemAssignmentRepositoryImpl implements CustomItemAssignmentRepository {

    private static final String FIELD_ITEM_ID = "itemId";
    private static final String FIELD_TARGET_TYPE = "targetType";
    private static final String FIELD_DISPLAY_NAME = "displayName";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String ID_FIELD = "_id";
    private static final String AGG_COUNT = "count";
    private static final String SORT_DESC = "DESC";

    private static final String DEFAULT_SORT_FIELD = FIELD_CREATED_AT;

    private static final List<String> SORTABLE_FIELDS = List.of(
            FIELD_CREATED_AT,
            FIELD_DISPLAY_NAME
    );

    private final MongoTemplate mongoTemplate;

    public CustomItemAssignmentRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public Query buildAssignmentQuery(String itemId, AssignmentTargetType targetType, String search) {
        Query query = new Query();
        query.addCriteria(Criteria.where(FIELD_ITEM_ID).is(itemId));
        query.addCriteria(Criteria.where(FIELD_TARGET_TYPE).is(targetType));

        if (search != null && !search.trim().isEmpty()) {
            query.addCriteria(Criteria.where(FIELD_DISPLAY_NAME).regex(search.trim(), "i"));
        }

        return query;
    }

    @Override
    public List<ItemAssignment> findAssignmentsWithCursor(Query query, String cursor, int limit,
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

        if (ID_FIELD.equals(sortField)) {
            query.with(Sort.by(direction, ID_FIELD));
        } else {
            query.with(Sort.by(
                    Sort.Order.by(sortField).with(direction),
                    Sort.Order.by(ID_FIELD).with(direction)
            ));
        }
        query.limit(limit);

        return mongoTemplate.find(query, ItemAssignment.class);
    }

    private void applyCursorCriteria(Query query, ObjectId cursorId, String sortField, boolean isDesc) {
        if (ID_FIELD.equals(sortField)) {
            query.addCriteria(isDesc
                    ? Criteria.where(ID_FIELD).lt(cursorId)
                    : Criteria.where(ID_FIELD).gt(cursorId));
            return;
        }

        ItemAssignment cursorDoc = mongoTemplate.findById(cursorId, ItemAssignment.class);
        if (cursorDoc == null) {
            log.warn("Cursor document not found for id: {}", cursorId);
            query.addCriteria(isDesc
                    ? Criteria.where(ID_FIELD).lt(cursorId)
                    : Criteria.where(ID_FIELD).gt(cursorId));
            return;
        }

        Object cursorSortValue = getSortFieldValue(cursorDoc, sortField);
        if (cursorSortValue == null) {
            query.addCriteria(isDesc
                    ? Criteria.where(ID_FIELD).lt(cursorId)
                    : Criteria.where(ID_FIELD).gt(cursorId));
            return;
        }

        Criteria pastSortValue = isDesc
                ? Criteria.where(sortField).lt(cursorSortValue)
                : Criteria.where(sortField).gt(cursorSortValue);

        Criteria sameSortValuePastId = new Criteria().andOperator(
                Criteria.where(sortField).is(cursorSortValue),
                isDesc ? Criteria.where(ID_FIELD).lt(cursorId) : Criteria.where(ID_FIELD).gt(cursorId)
        );

        query.addCriteria(Criteria.where("$or").is(
                List.of(pastSortValue.getCriteriaObject(), sameSortValuePastId.getCriteriaObject())
        ));
    }

    private Object getSortFieldValue(ItemAssignment assignment, String sortField) {
        return switch (sortField) {
            case FIELD_DISPLAY_NAME -> assignment.getDisplayName();
            case FIELD_CREATED_AT -> assignment.getCreatedAt();
            default -> null;
        };
    }

    @Override
    public long countAssignments(Query query) {
        return mongoTemplate.count(query, ItemAssignment.class);
    }

    @Override
    public Map<AssignmentTargetType, Long> countByItemIdGroupedByTargetType(String itemId) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where(FIELD_ITEM_ID).is(itemId)),
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
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field.trim());
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_FIELD;
    }
}
