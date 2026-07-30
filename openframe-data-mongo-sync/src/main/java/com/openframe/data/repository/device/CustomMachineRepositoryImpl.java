package com.openframe.data.repository.device;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.util.MachineOsClassifier;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Slf4j
public class CustomMachineRepositoryImpl implements CustomMachineRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String OS_TYPE_FIELD = "osType";

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

    @Override
    public List<Machine> findMachinesWithCursor(Query query, String cursor, int limit,
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
    public List<String> findMachineIds(Query query) {
        return mongoTemplate.findDistinct(query, "machineId", Machine.class, String.class);
    }

    @Override
    public long countMachines(Query query) {
        return mongoTemplate.count(query, Machine.class);
    }

    @Override
    public List<String> findMachineIdsByCriteria(String tenantId, MachineQueryFilter filter,
                                                 Collection<String> osTypeScope) {
        return findMachineIds(buildCriteriaQuery(tenantId, filter, osTypeScope));
    }

    private Query buildCriteriaQuery(String tenantId, MachineQueryFilter filter, Collection<String> osTypeScope) {
        Query query = buildDeviceQuery(filter, null);
        query.addCriteria(Criteria.where("tenantId").is(tenantId));
        osTypeOrCriteria(osTypeScope).ifPresent(query::addCriteria);
        return query;
    }

    @Override
    public Query buildDeviceQuery(MachineQueryFilter filter, String search) {
        List<Criteria> criteriaList = new ArrayList<>();

        if (filter != null) {
            if (filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
                criteriaList.add(Criteria.where("status").in(filter.getStatuses()));
            }
            if (filter.getDeviceTypes() != null && !filter.getDeviceTypes().isEmpty()) {
                criteriaList.add(Criteria.where("type").in(filter.getDeviceTypes()));
            }
            if (filter.getOsTypes() != null && !filter.getOsTypes().isEmpty()) {
                List<Criteria> perOs = osTypeCriteriaList(filter.getOsTypes());
                if (!perOs.isEmpty()) {
                    criteriaList.add(new Criteria().orOperator(perOs.toArray(new Criteria[0])));
                }
            }
            if (filter.getOrganizationIds() != null && !filter.getOrganizationIds().isEmpty()) {
                criteriaList.add(Criteria.where("organizationId").in(filter.getOrganizationIds()));
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
