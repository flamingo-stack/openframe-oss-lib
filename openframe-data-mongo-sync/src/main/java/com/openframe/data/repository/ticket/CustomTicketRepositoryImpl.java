package com.openframe.data.repository.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusKind;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
public class CustomTicketRepositoryImpl implements CustomTicketRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String DEFAULT_SORT_FIELD = "_id";

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_STATUS_ID = "statusId";
    private static final String FIELD_STATUS_KIND = "statusKind";
    private static final String FIELD_TICKET_NUMBER = "ticketNumber";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_ASSIGNED_TO = "assignedTo";
    private static final String FIELD_DEVICE_ID = "deviceId";
    private static final String FIELD_CREATION_SOURCE = "creationSource";
    private static final String FIELD_OWNER_MACHINE_ID = "owner.machineId";
    private static final String FIELD_TITLE = "title";
    private static final String FIELD_DEVICE_HOSTNAME = "deviceHostname";
    private static final String FIELD_ORGANIZATION_NAME = "organizationName";
    private static final String FIELD_ASSIGNED_NAME = "assignedName";
    private static final String FIELD_CREATED_AT = "createdAt";
    private static final String FIELD_UPDATED_AT = "updatedAt";
    private static final String FIELD_RESOLVED_AT = "resolvedAt";
    private static final String FIELD_ORDER = "order";

    private static final String AGG_COUNT = "count";
    private static final String AGG_RESOLUTION_TIME = "resolutionTime";
    private static final String AGG_AVG_RESOLUTION_TIME = "avgResolutionTime";

    private static final List<String> SORTABLE_FIELDS = List.of(
            ID_FIELD,
            FIELD_TICKET_NUMBER,
            FIELD_STATUS,
            FIELD_STATUS_KIND,
            FIELD_ORGANIZATION_NAME,
            FIELD_ASSIGNED_NAME,
            FIELD_DEVICE_HOSTNAME,
            FIELD_CREATED_AT,
            FIELD_UPDATED_AT,
            FIELD_RESOLVED_AT,
            FIELD_ORDER
    );

    private final MongoTemplate mongoTemplate;

    public CustomTicketRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public Query buildTicketQuery(String tenantId,
                                  TicketQueryFilter filter,
                                  String search,
                                  List<String> restrictToTicketIds,
                                  String ownerMachineId) {
        Query query = new Query();
        query.addCriteria(Criteria.where(FIELD_TENANT_ID).is(tenantId));

        applyFilterCriteria(query, filter);
        applyRestrictionCriteria(query, restrictToTicketIds);
        applyOwnerMachineCriteria(query, ownerMachineId);
        applySearchCriteria(query, search);

        return query;
    }

    private void applyFilterCriteria(Query query, TicketQueryFilter filter) {
        if (filter == null) {
            return;
        }
        addCriteriaIfNotEmpty(query, FIELD_STATUS_ID, filter.getStatusIds());
        addCriteriaIfNotEmpty(query, FIELD_STATUS_KIND, filter.getStatusKinds());
        addCriteriaIfNotEmpty(query, FIELD_ORGANIZATION_ID, filter.getOrganizationIds());
        addCriteriaIfNotEmpty(query, FIELD_ASSIGNED_TO, filter.getAssigneeIds());
        addCriteriaIfNotEmpty(query, FIELD_DEVICE_ID, filter.getDeviceIds());
        addCriteriaIfNotEmpty(query, FIELD_CREATION_SOURCE, filter.getCreationSources());
        applyCreatedAtRange(query, filter.getCreatedAtFrom(), filter.getCreatedAtTo());
    }

    private void applyRestrictionCriteria(Query query, List<String> restrictToTicketIds) {
        if (restrictToTicketIds == null) {
            return;
        }
        if (restrictToTicketIds.isEmpty()) {
            query.addCriteria(Criteria.where(ID_FIELD).is(null));
        } else {
            query.addCriteria(Criteria.where(ID_FIELD).in(restrictToTicketIds));
        }
    }

    private void applyOwnerMachineCriteria(Query query, String ownerMachineId) {
        if (!hasText(ownerMachineId)) {
            return;
        }
        query.addCriteria(Criteria.where(FIELD_OWNER_MACHINE_ID).is(ownerMachineId));
    }

    private void applySearchCriteria(Query query, String search) {
        if (!hasText(search)) {
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
        if (isEmpty(values)) {
            return;
        }
        query.addCriteria(Criteria.where(field).in(values));
    }

    private void applyCreatedAtRange(Query query, Instant from, Instant to) {
        if (from == null && to == null) {
            return;
        }
        Criteria criteria = Criteria.where(FIELD_CREATED_AT);
        if (from != null) {
            criteria = criteria.gte(from);
        }
        if (to != null) {
            criteria = criteria.lt(to);
        }
        query.addCriteria(criteria);
    }

    @Override
    public List<Ticket> findTicketsWithCursor(Query query,
                                              String cursor,
                                              int limit,
                                              String sortField,
                                              String sortDirection) {
        boolean isDesc = SORT_DESC.equalsIgnoreCase(sortDirection);
        Sort.Direction mongoSortDirection = isDesc ? Sort.Direction.DESC : Sort.Direction.ASC;

        applyCursorIfPresent(query, cursor, sortField, isDesc);
        query.limit(limit);
        applySortOrder(query, sortField, mongoSortDirection);

        return mongoTemplate.find(query, Ticket.class);
    }

    private void applyCursorIfPresent(Query query, String cursor, String sortField, boolean isDesc) {
        if (!hasText(cursor)) {
            return;
        }
        try {
            ObjectId cursorId = new ObjectId(cursor);
            applyCursorCriteria(query, cursorId, sortField, isDesc);
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid ObjectId cursor format: {}", cursor);
        }
    }

    private void applySortOrder(Query query, String sortField, Sort.Direction direction) {
        if (ID_FIELD.equals(sortField)) {
            query.with(Sort.by(direction, ID_FIELD));
            return;
        }
        query.with(Sort.by(
                Sort.Order.by(sortField).with(direction),
                Sort.Order.by(ID_FIELD).with(direction)
        ));
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
            case FIELD_STATUS_KIND -> ticket.getStatusKind() != null ? ticket.getStatusKind().name() : null;
            case FIELD_ORGANIZATION_NAME -> ticket.getOrganizationName();
            case FIELD_ASSIGNED_NAME -> ticket.getAssignedName();
            case FIELD_DEVICE_HOSTNAME -> ticket.getDeviceHostname();
            case FIELD_CREATED_AT -> ticket.getCreatedAt();
            case FIELD_UPDATED_AT -> ticket.getUpdatedAt();
            case FIELD_RESOLVED_AT -> ticket.getResolvedAt();
            case FIELD_ORDER -> ticket.getOrder();
            default -> null;
        };
    }

    @Override
    public long countTickets(Query query) {
        return mongoTemplate.count(query, Ticket.class);
    }

    @Override
    public Map<TicketStatusKind, Long> countTicketsByStatusKind(String tenantId) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where(FIELD_TENANT_ID).is(tenantId)),
                Aggregation.group(FIELD_STATUS_KIND).count().as(AGG_COUNT),
                Aggregation.project(AGG_COUNT).and(ID_FIELD).as(FIELD_STATUS_KIND)
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, Ticket.class, Document.class);

        Map<TicketStatusKind, Long> kindCounts = new EnumMap<>(TicketStatusKind.class);
        for (Document doc : results.getMappedResults()) {
            String kindStr = doc.getString(FIELD_STATUS_KIND);
            if (!hasText(kindStr)) {
                continue;
            }
            try {
                TicketStatusKind kind = TicketStatusKind.valueOf(kindStr);
                kindCounts.put(kind, doc.getInteger(AGG_COUNT).longValue());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown ticket status kind: {}", kindStr);
            }
        }
        return kindCounts;
    }

    @Override
    public Map<String, Long> countTicketsByStatusId(String tenantId) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where(FIELD_TENANT_ID).is(tenantId)),
                Aggregation.group(FIELD_STATUS_ID).count().as(AGG_COUNT),
                Aggregation.project(AGG_COUNT).and(ID_FIELD).as(FIELD_STATUS_ID)
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, Ticket.class, Document.class);

        Map<String, Long> statusCounts = new HashMap<>();
        for (Document doc : results.getMappedResults()) {
            String statusId = doc.getString(FIELD_STATUS_ID);
            if (!hasText(statusId)) {
                continue;
            }
            statusCounts.put(statusId, doc.getInteger(AGG_COUNT).longValue());
        }
        return statusCounts;
    }

    @Override
    public long getTotalCount(String tenantId) {
        Query query = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId));
        return mongoTemplate.count(query, Ticket.class);
    }

    @Override
    public Optional<Long> getAverageResolutionTimeMs(String tenantId) {
        Aggregation aggregation = Aggregation.newAggregation(
                Aggregation.match(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                        .and(FIELD_RESOLVED_AT).ne(null)
                        .and(FIELD_CREATED_AT).ne(null)),
                Aggregation.project()
                        .andExpression(FIELD_RESOLVED_AT + " - " + FIELD_CREATED_AT).as(AGG_RESOLUTION_TIME),
                Aggregation.group().avg(AGG_RESOLUTION_TIME).as(AGG_AVG_RESOLUTION_TIME)
        );

        AggregationResults<Document> results = mongoTemplate.aggregate(
                aggregation, Ticket.class, Document.class);

        Document result = results.getUniqueMappedResult();
        if (result == null || result.get(AGG_AVG_RESOLUTION_TIME) == null) {
            return Optional.empty();
        }
        Number avg = (Number) result.get(AGG_AVG_RESOLUTION_TIME);
        return Optional.of(avg.longValue());
    }

    @Override
    public int reassignTicketsToStatus(String tenantId,
                                       String fromStatusId,
                                       String toStatusId,
                                       TicketStatusKind toKind) {
        Query query = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(FIELD_STATUS_ID).is(fromStatusId));
        Update update = new Update()
                .set(FIELD_STATUS_ID, toStatusId)
                .set(FIELD_STATUS_KIND, toKind)
                .set(FIELD_UPDATED_AT, Instant.now());

        long modifiedCount = mongoTemplate.updateMulti(query, update, Ticket.class).getModifiedCount();
        log.info("Reassigned {} tickets from statusId {} to {} for tenant {}",
                modifiedCount, fromStatusId, toStatusId, tenantId);
        return (int) modifiedCount;
    }

    @Override
    public void updateTitle(String tenantId, String ticketId, String title) {
        Query query = new Query(Criteria.where(FIELD_TENANT_ID).is(tenantId)
                .and(ID_FIELD).is(ticketId));
        Update update = new Update()
                .set(FIELD_TITLE, title)
                .set(FIELD_UPDATED_AT, Instant.now());

        mongoTemplate.updateFirst(query, update, Ticket.class);
    }

    @Override
    public boolean isSortableField(String field) {
        return hasText(field) && SORTABLE_FIELDS.contains(field.trim());
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_FIELD;
    }

    // ===== Legacy methods (used when lifecycle feature flag is OFF) =====

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

        applyRestrictionCriteria(query, restrictToTicketIds);
        applyOwnerMachineCriteria(query, ownerMachineId);
        applySearchCriteria(query, search);
        return query;
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
            if (!hasText(statusStr)) {
                continue;
            }
            try {
                TicketStatus status = TicketStatus.valueOf(statusStr);
                statusCounts.put(status, doc.getInteger(AGG_COUNT).longValue());
            } catch (IllegalArgumentException e) {
                log.warn("Unknown ticket status: {}", statusStr);
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
        if (result == null || result.get(AGG_AVG_RESOLUTION_TIME) == null) {
            return Optional.empty();
        }
        Number avg = (Number) result.get(AGG_AVG_RESOLUTION_TIME);
        return Optional.of(avg.longValue());
    }

    @Override
    public int updateStatusBulk(TicketStatus fromStatus, TicketStatus toStatus) {
        Query query = new Query(Criteria.where(FIELD_STATUS).is(fromStatus));
        Update update = new Update()
                .set(FIELD_STATUS, toStatus)
                .set(FIELD_UPDATED_AT, Instant.now());

        long modifiedCount = mongoTemplate.updateMulti(query, update, Ticket.class).getModifiedCount();
        log.debug("Bulk status update (legacy): {} -> {}, modified: {}", fromStatus, toStatus, modifiedCount);
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
}
