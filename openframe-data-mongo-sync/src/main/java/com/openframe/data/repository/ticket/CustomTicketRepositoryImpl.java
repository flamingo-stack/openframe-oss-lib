package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
public class CustomTicketRepositoryImpl implements CustomTicketRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String DEFAULT_SORT_FIELD = "_id";

    private static final String FIELD_STATUS = "status";
    private static final String FIELD_TICKET_NUMBER = "ticketNumber";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_ASSIGNED_TO = "assignedTo";
    private static final String FIELD_DEVICE_ID = "deviceId";
    private static final String FIELD_OWNER_MACHINE_ID = "owner.machineId";
    private static final String FIELD_TITLE = "title";
    private static final String FIELD_DEVICE_HOSTNAME = "deviceHostname";
    private static final String FIELD_ORGANIZATION_NAME = "organizationName";
    private static final String FIELD_ASSIGNED_NAME = "assignedName";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String FIELD_RESOLVED_AT = "resolvedAt";

    private static final String AGG_COUNT = "count";
    private static final String AGG_RESOLUTION_TIME = "resolutionTime";
    private static final String AGG_AVG_RESOLUTION_TIME = "avgResolutionTime";

    private static final List<String> SORTABLE_FIELDS = List.of(
            ID_FIELD,
            FIELD_TICKET_NUMBER,
            FIELD_STATUS,
            FIELD_ORGANIZATION_NAME,
            FIELD_ASSIGNED_NAME,
            FIELD_DEVICE_HOSTNAME,
            FIELD_CREATED_AT,
            FIELD_UPDATED_AT,
            FIELD_RESOLVED_AT
    );

    private final MongoTemplate mongoTemplate;

    public CustomTicketRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public Query buildTicketQuery(TicketQueryFilter filter, String search,
                                   List<String> restrictToTicketIds, String ownerMachineId) {
        Query query = new Query();

        if (filter != null) {
            addCriteriaIfNotEmpty(query, FIELD_STATUS, filter.getStatuses());
            addCriteriaIfNotEmpty(query, FIELD_ORGANIZATION_ID, filter.getOrganizationIds());
            addCriteriaIfNotEmpty(query, FIELD_ASSIGNED_TO, filter.getAssigneeIds());
            addCriteriaIfNotEmpty(query, FIELD_DEVICE_ID, filter.getDeviceIds());
        }

        if (restrictToTicketIds != null) {
            if (restrictToTicketIds.isEmpty()) {
                query.addCriteria(Criteria.where(ID_FIELD).is(null));
            } else {
                query.addCriteria(Criteria.where(ID_FIELD).in(restrictToTicketIds));
            }
        }

        if (ownerMachineId != null) {
            query.addCriteria(Criteria.where(FIELD_OWNER_MACHINE_ID).is(ownerMachineId));
        }

        applySearchCriteria(query, search);
        return query;
    }

    private void applySearchCriteria(Query query, String search) {
        if (search == null || search.trim().isEmpty()) {
            return;
        }
        String searchTrimmed = search.trim();
        Criteria searchCriteria = new Criteria().orOperator(
                Criteria.where(FIELD_TITLE).regex(searchTrimmed, "i"),
                Criteria.where(FIELD_DEVICE_HOSTNAME).regex(searchTrimmed, "i"),
                Criteria.where(FIELD_ORGANIZATION_NAME).regex(searchTrimmed, "i"),
                Criteria.where(FIELD_ASSIGNED_NAME).regex(searchTrimmed, "i")
        );
        query.addCriteria(searchCriteria);
    }

    private void addCriteriaIfNotEmpty(Query query, String field, List<?> values) {
        if (values != null && !values.isEmpty()) {
            query.addCriteria(Criteria.where(field).in(values));
        }
    }

    @Override
    public List<Ticket> findTicketsWithCursor(Query query, String cursor, int limit,
                                               String sortField, String sortDirection) {
        boolean isDesc = SORT_DESC.equalsIgnoreCase(sortDirection);
        Sort.Direction mongoSortDirection = isDesc ? Sort.Direction.DESC : Sort.Direction.ASC;

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
            query.with(Sort.by(mongoSortDirection, ID_FIELD));
        } else {
            query.with(Sort.by(
                    Sort.Order.by(sortField).with(mongoSortDirection),
                    Sort.Order.by(ID_FIELD).with(mongoSortDirection)
            ));
        }

        return mongoTemplate.find(query, Ticket.class);
    }

    private void applyCursorCriteria(Query query, ObjectId cursorId, String sortField, boolean isDesc) {
        if (ID_FIELD.equals(sortField)) {
            query.addCriteria(buildIdCriteria(cursorId, isDesc));
            return;
        }

        Ticket cursorDoc = mongoTemplate.findById(cursorId, Ticket.class);
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

    private Object getSortFieldValue(Ticket ticket, String sortField) {
        return switch (sortField) {
            case FIELD_TICKET_NUMBER -> ticket.getTicketNumber();
            case FIELD_STATUS -> ticket.getStatus() != null ? ticket.getStatus().name() : null;
            case FIELD_ORGANIZATION_NAME -> ticket.getOrganizationName();
            case FIELD_ASSIGNED_NAME -> ticket.getAssignedName();
            case FIELD_DEVICE_HOSTNAME -> ticket.getDeviceHostname();
            case FIELD_CREATED_AT -> ticket.getCreatedAt();
            case FIELD_UPDATED_AT -> ticket.getUpdatedAt();
            case FIELD_RESOLVED_AT -> ticket.getResolvedAt();
            default -> null;
        };
    }

    @Override
    public long countTickets(Query query) {
        return mongoTemplate.count(query, Ticket.class);
    }

    @Override
    public Map<TicketStatus, Long> countTicketsByStatus() {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.group(FIELD_STATUS).count().as(AGG_COUNT),
                Aggregation.project(AGG_COUNT).and(ID_FIELD).as(FIELD_STATUS)
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, Ticket.class, Document.class);

        Map<TicketStatus, Long> statusCounts = new EnumMap<>(TicketStatus.class);
        for (Document doc : results.getMappedResults()) {
            String statusStr = doc.getString(FIELD_STATUS);
            if (statusStr != null) {
                try {
                    TicketStatus status = TicketStatus.valueOf(statusStr);
                    statusCounts.put(status, doc.getInteger(AGG_COUNT).longValue());
                } catch (IllegalArgumentException e) {
                    log.warn("Unknown ticket status: {}", statusStr);
                }
            }
        }

        return statusCounts;
    }

    @Override
    public long getTotalCount() {
        return mongoTemplate.count(new Query(), Ticket.class);
    }

    @Override
    public Optional<Long> getAverageResolutionTimeMs() {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where(FIELD_RESOLVED_AT).ne(null)
                        .and(FIELD_CREATED_AT).ne(null)),
                Aggregation.project()
                        .andExpression(FIELD_RESOLVED_AT + " - " + FIELD_CREATED_AT).as(AGG_RESOLUTION_TIME),
                Aggregation.group().avg(AGG_RESOLUTION_TIME).as(AGG_AVG_RESOLUTION_TIME)
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, Ticket.class, Document.class);

        Document result = results.getUniqueMappedResult();
        if (result != null && result.get(AGG_AVG_RESOLUTION_TIME) != null) {
            Number avg = (Number) result.get(AGG_AVG_RESOLUTION_TIME);
            return Optional.of(avg.longValue());
        }

        return Optional.empty();
    }

    @Override
    public int updateStatusBulk(TicketStatus fromStatus, TicketStatus toStatus) {
        Query query = new Query(Criteria.where(FIELD_STATUS).is(fromStatus));
        Update update = new Update()
                .set(FIELD_STATUS, toStatus)
                .set(FIELD_UPDATED_AT, Instant.now());

        long modifiedCount = mongoTemplate.updateMulti(query, update, Ticket.class).getModifiedCount();
        log.debug("Bulk status update: {} -> {}, modified: {}", fromStatus, toStatus, modifiedCount);

        return (int) modifiedCount;
    }

    @Override
    public void updateTitle(String ticketId, String title) {
        Query query = new Query(Criteria.where(ID_FIELD).is(ticketId));
        Update update = new Update()
                .set(FIELD_TITLE, title)
                .set(FIELD_UPDATED_AT, Instant.now());

        mongoTemplate.updateFirst(query, update, Ticket.class);
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
