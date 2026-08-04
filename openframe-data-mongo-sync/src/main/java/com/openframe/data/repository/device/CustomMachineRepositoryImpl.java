package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.util.MachineOsClassifier;
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

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Slf4j
public class CustomMachineRepositoryImpl implements CustomMachineRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String OS_TYPE_FIELD = "osType";
    private static final String MACHINE_ID_FIELD = "machineId";
    private static final String STATUS_FIELD = "status";
    private static final String TYPE_FIELD = "type";
    private static final String ORGANIZATION_ID_FIELD = "organizationId";
    private static final String COUNT_FIELD = "count";
    private static final String BUCKET_FIELD = "_availableBucket";
    private static final String ONLINE_STATUS = "ONLINE";
    private static final String CURSOR_SEPARATOR = "|";

    private static final List<String> SORTABLE_FIELDS = List.of(
            "_id",
            "hostname",
            "displayName",
            "status",
            "lastSeen"
    );
    private static final String DEFAULT_SORT_FIELD = "_id";

    private final MongoTemplate mongoTemplate;

    public CustomMachineRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    private List<Machine> findMachinesWithCursor(Query query, String cursor, int limit,
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

        return mongoTemplate.find(query, Machine.class);
    }

    private List<Machine> findAvailableForScheduleWithCursor(Query baseQuery, Collection<String> assignedMachineIds,
                                                            String cursor, int limit) {
        List<String> assigned = assignedMachineIds == null ? List.of() : new ArrayList<>(assignedMachineIds);

        List<AggregationOperation> ops = new ArrayList<>();
        // $match: the platform/filter/search predicate already assembled in the Query.
        Document match = baseQuery.getQueryObject();
        ops.add(ctx -> new Document("$match", match));
        // $addFields: bucket 0..3 = (assigned ? 0 : 2) + (ONLINE ? 0 : 1).
        ops.add(bucketAddFieldsStage(assigned));
        // Keyset cursor over (bucket, _id), then the matching sort.
        appendBucketCursor(ops, cursor);
        ops.add(ctx -> new Document("$sort", new Document(BUCKET_FIELD, 1).append(ID_FIELD, 1)));
        ops.add(Aggregation.limit(limit));

        AggregationResults<Document> results =
                mongoTemplate.aggregate(Aggregation.newAggregation(ops), Machine.class, Document.class);
        return results.getMappedResults().stream()
                .map(d -> mongoTemplate.getConverter().read(Machine.class, d))
                .toList();
    }

    private static AggregationOperation bucketAddFieldsStage(List<String> assignedMachineIds) {
        Document assignedRank = new Document("$cond", List.of(
                new Document("$in", List.of("$" + MACHINE_ID_FIELD, assignedMachineIds)), 0, 2));
        Document statusRank = new Document("$cond", List.of(
                new Document("$eq", List.of("$" + STATUS_FIELD, ONLINE_STATUS)), 0, 1));
        Document bucket = new Document("$add", List.of(assignedRank, statusRank));
        Document addFields = new Document("$addFields", new Document(BUCKET_FIELD, bucket));
        return ctx -> addFields;
    }

    /** Compound keyset on ascending (bucket, _id): rows strictly after the cursor. Format "bucket|objectIdHex". */
    private static void appendBucketCursor(List<AggregationOperation> ops, String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return;
        }
        int separator = cursor.lastIndexOf(CURSOR_SEPARATOR);
        if (separator < 0) {
            log.warn("Invalid availableDevices cursor (no separator): '{}' — falling back to first page", cursor);
            return;
        }
        ObjectId cursorId;
        try {
            cursorId = new ObjectId(cursor.substring(separator + 1));
        } catch (IllegalArgumentException ex) {
            log.warn("Invalid availableDevices cursor id: '{}' — falling back to first page", cursor);
            return;
        }
        int bucket;
        try {
            bucket = Integer.parseInt(cursor.substring(0, separator));
        } catch (NumberFormatException ex) {
            log.warn("Unparseable availableDevices bucket in cursor '{}' — falling back to first page", cursor);
            return;
        }
        Document orExpr = new Document("$or", List.of(
                new Document(BUCKET_FIELD, new Document("$gt", bucket)),
                new Document(BUCKET_FIELD, bucket).append(ID_FIELD, new Document("$gt", cursorId))));
        ops.add(ctx -> new Document("$match", orExpr));
    }

    private void applyCursorCriteria(Query query, ObjectId cursorId, String sortField, boolean isDesc) {
        if (ID_FIELD.equals(sortField)) {
            query.addCriteria(isDesc ?
                Criteria.where(ID_FIELD).lt(cursorId) :
                Criteria.where(ID_FIELD).gt(cursorId));
            return;
        }

        Machine cursorDoc = mongoTemplate.findById(cursorId, Machine.class);
        if (cursorDoc == null) {
            log.warn("Cursor document not found for id: {}", cursorId);
            query.addCriteria(isDesc ?
                Criteria.where(ID_FIELD).lt(cursorId) :
                Criteria.where(ID_FIELD).gt(cursorId));
            return;
        }

        Object cursorSortValue = getSortFieldValue(cursorDoc, sortField);
        if (cursorSortValue == null) {
            query.addCriteria(isDesc ?
                Criteria.where(ID_FIELD).lt(cursorId) :
                Criteria.where(ID_FIELD).gt(cursorId));
            return;
        }

        Criteria pastSortValue = isDesc ?
            Criteria.where(sortField).lt(cursorSortValue) :
            Criteria.where(sortField).gt(cursorSortValue);

        Criteria sameSortValuePastId = new Criteria().andOperator(
            Criteria.where(sortField).is(cursorSortValue),
            isDesc ? Criteria.where(ID_FIELD).lt(cursorId) : Criteria.where(ID_FIELD).gt(cursorId)
        );

        query.addCriteria(Criteria.where("$or").is(
                List.of(pastSortValue.getCriteriaObject(), sameSortValuePastId.getCriteriaObject())
        ));
    }

    private Object getSortFieldValue(Machine machine, String sortField) {
        return switch (sortField) {
            case "hostname" -> machine.getHostname();
            case "displayName" -> machine.getDisplayName();
            case "status" -> machine.getStatus() != null ? machine.getStatus().name() : null;
            case "lastSeen" -> machine.getLastSeen();
            default -> null;
        };
    }

    @Override
    public long countMachines(MachineQueryFilter filter, String search) {
        return mongoTemplate.count(buildDeviceQuery(filter, search), Machine.class);
    }

    @Override
    public List<String> findMachineIds(MachineQueryFilter filter, String search) {
        return mongoTemplate.findDistinct(buildDeviceQuery(filter, search),
                MACHINE_ID_FIELD, Machine.class, String.class);
    }

    @Override
    public List<Machine> findMachinesWithCursor(MachineQueryFilter filter, String search,
                                                String cursor, int limit,
                                                String sortField, String sortDirection) {
        return findMachinesWithCursor(buildDeviceQuery(filter, search),
                cursor, limit, sortField, sortDirection);
    }

    @Override
    public List<Machine> findAvailableForScheduleWithCursor(MachineQueryFilter filter, String search,
                                                            Collection<String> assignedMachineIds,
                                                            String cursor, int limit) {
        return findAvailableForScheduleWithCursor(buildDeviceQuery(filter, search),
                assignedMachineIds, cursor, limit);
    }

    @Override
    public Map<String, Integer> facet(MachineQueryFilter filter, String search, String field) {
        Query query = buildDeviceQuery(filter, search, field);
        Aggregation agg = Aggregation.newAggregation(
                ctx -> new Document("$match", query.getQueryObject()),
                Aggregation.group(field).count().as(COUNT_FIELD));
        AggregationResults<Document> results =
                mongoTemplate.aggregate(agg, Machine.class, Document.class);

        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Document doc : results.getMappedResults()) {
            Object id = doc.get(ID_FIELD);
            if (id == null) {
                // Rows with a null group key (e.g. a device with no organizationId) are not an option.
                continue;
            }
            counts.put(id.toString(), ((Number) doc.get(COUNT_FIELD)).intValue());
        }
        return counts;
    }

    @Override
    public List<String> findMachineIdsByCriteria(String tenantId, MachineQueryFilter filter,
                                                 Collection<String> osTypeScope) {
        return mongoTemplate.findDistinct(buildCriteriaQuery(tenantId, filter, osTypeScope),
                MACHINE_ID_FIELD, Machine.class, String.class);
    }

    @Override
    public long countMachinesByCriteria(String tenantId, MachineQueryFilter filter,
                                        Collection<String> osTypeScope) {
        return mongoTemplate.count(buildCriteriaQuery(tenantId, filter, osTypeScope), Machine.class);
    }

    private Query buildCriteriaQuery(String tenantId, MachineQueryFilter filter, Collection<String> osTypeScope) {
        Query query = buildDeviceQuery(filter, null);
        query.addCriteria(Criteria.where("tenantId").is(tenantId));
        osTypeOrCriteria(osTypeScope).ifPresent(query::addCriteria);
        return query;
    }

    Query buildDeviceQuery(MachineQueryFilter filter, String search) {
        return buildDeviceQuery(filter, search, null);
    }

    Query buildDeviceQuery(MachineQueryFilter filter, String search, String excludeField) {
        List<Criteria> criteriaList = new ArrayList<>();
        boolean statusExcluded = STATUS_FIELD.equals(excludeField);
        boolean callerConstrainsStatus = !statusExcluded && filter != null
                && filter.getStatuses() != null && !filter.getStatuses().isEmpty();
        if (!callerConstrainsStatus) {
            criteriaList.add(Criteria.where("status").ne(DeviceStatus.DELETED));
        }

        if (filter != null) {
            if (!statusExcluded && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
                criteriaList.add(Criteria.where("status").in(filter.getStatuses()));
            }
            if (!TYPE_FIELD.equals(excludeField)
                    && filter.getDeviceTypes() != null && !filter.getDeviceTypes().isEmpty()) {
                criteriaList.add(Criteria.where("type").in(filter.getDeviceTypes()));
            }
            if (!OS_TYPE_FIELD.equals(excludeField)
                    && filter.getOsTypes() != null && !filter.getOsTypes().isEmpty()) {
                List<Criteria> perOs = osTypeCriteriaList(filter.getOsTypes());
                if (!perOs.isEmpty()) {
                    criteriaList.add(new Criteria().orOperator(perOs.toArray(new Criteria[0])));
                }
            }
            if (!ORGANIZATION_ID_FIELD.equals(excludeField)
                    && filter.getOrganizationIds() != null && !filter.getOrganizationIds().isEmpty()) {
                criteriaList.add(Criteria.where("organizationId").in(filter.getOrganizationIds()));
            }
            osTypeOrCriteria(filter.getPlatformNames()).ifPresent(criteriaList::add);
            Collection<String> restrict = filter.getRestrictToMachineIds();
            if (restrict != null) {
                if (restrict.isEmpty()) {
                    criteriaList.add(Criteria.where(MACHINE_ID_FIELD).exists(false));
                } else {
                    criteriaList.add(Criteria.where(MACHINE_ID_FIELD).in(restrict));
                }
            }
        }

        if (search != null && !search.isEmpty()) {
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("hostname").regex(search, "i"),
                    Criteria.where("displayName").regex(search, "i"),
                    Criteria.where("ip").regex(search, "i"),
                    Criteria.where("serialNumber").regex(search, "i"),
                    Criteria.where("manufacturer").regex(search, "i"),
                    Criteria.where("model").regex(search, "i")
            ));
        }

        Query query = new Query();
        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }
        return query;
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field.trim());
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_FIELD;
    }

    private static Optional<Criteria> osTypeOrCriteria(Collection<String> osTypeScope) {
        if (osTypeScope == null || osTypeScope.isEmpty()) {
            return Optional.empty();
        }
        List<Document> perPlatform = osTypeScope.stream()
                .filter(Objects::nonNull)
                .map(name -> osTypeCriteria(name).getCriteriaObject())
                .toList();
        return perPlatform.isEmpty() ? Optional.empty()
                : Optional.of(Criteria.where("$or").is(perPlatform));
    }

    private static List<Criteria> osTypeCriteriaList(Collection<String> osTypeScope) {
        return osTypeScope.stream()
                .filter(Objects::nonNull)
                .map(CustomMachineRepositoryImpl::osTypeCriteria)
                .toList();
    }

    private static Criteria osTypeCriteria(String rawOsType) {
        return Criteria.where(OS_TYPE_FIELD).regex(MachineOsClassifier.matchRegex(rawOsType), "i");
    }
}
