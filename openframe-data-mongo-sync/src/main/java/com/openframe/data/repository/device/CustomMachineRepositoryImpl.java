package com.openframe.data.repository.device;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.filter.DeviceFacetDimension;
import com.openframe.data.document.device.filter.MachineQueryFilter;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
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
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.util.Assert;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collector;
import java.util.stream.Stream;

import static java.util.stream.Collectors.joining;
import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
public class CustomMachineRepositoryImpl implements CustomMachineRepository {

    private static final String SORT_DESC = "DESC";
    private static final String ID_FIELD = "_id";
    private static final String OS_TYPE_FIELD = "osType";
    private static final String MACHINE_ID_FIELD = "machineId";
    private static final String LAST_SEEN_FIELD = "lastSeen";
    private static final String STATUS_FIELD = "status";
    private static final String TYPE_FIELD = "type";
    private static final String ORGANIZATION_ID_FIELD = "organizationId";
    private static final String PACKAGE_MANAGERS_FIELD = "packageManagers";
    private static final String COUNT_FIELD = "count";
    private static final String BUCKET_FIELD = "_availableBucket";
    private static final String ONLINE_STATUS = "ONLINE";
    private static final String CURSOR_SEPARATOR = "|";

    private static final List<String> SORTABLE_FIELDS = List.of(
            "_id",
            "hostname",
            "displayName",
            "nickname",
            "status",
            "lastSeen"
    );
    private static final String DEFAULT_SORT_FIELD = "_id";

    private static final String TENANT_ID_FIELD = "tenantId";

    private final MongoTemplate mongoTemplate;

    public CustomMachineRepositoryImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public List<Machine> findMachines(String tenantId, MachineQueryFilter filter) {
        Assert.hasText(tenantId, "tenantId must not be blank");
        Query query = buildTenantQuery(tenantId, filter, "");
        return mongoTemplate.find(query, Machine.class);
    }

    private static Query withTenant(String tenantId, Query query) {
        return query.addCriteria(Criteria.where(TENANT_ID_FIELD).is(tenantId));
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
        // $match: the tenant + platform/filter/search predicate already assembled in the Query
        // (tenantId is added by the caller via withTenant(...) — aggregate() bypasses the
        // wrapping template's auto-scope, so we can't rely on that here).
        ops.add(ctx -> new Document("$match", baseQuery.getQueryObject()));
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
            if (isDesc) {
                // Trailing null group: only the remaining null rows, ordered by _id descending.
                query.addCriteria(Criteria.where(sortField).is(null).and(ID_FIELD).lt(cursorId));
            } else {
                // Leading null group: remaining null rows (by _id), then EVERY non-null row.
                addOrCriteria(query,
                        Criteria.where(sortField).is(null).and(ID_FIELD).gt(cursorId),
                        Criteria.where(sortField).ne(null)
                );
            }
            return;
        }

        Criteria pastSortValue = isDesc ?
            Criteria.where(sortField).lt(cursorSortValue) :
            Criteria.where(sortField).gt(cursorSortValue);

        Criteria sameSortValuePastId = isDesc ?
            Criteria.where(sortField).is(cursorSortValue).and(ID_FIELD).lt(cursorId) :
            Criteria.where(sortField).is(cursorSortValue).and(ID_FIELD).gt(cursorId);

        if (isDesc) {
            // Descending: null-valued rows sort AFTER every non-null value, so they belong on the
            // pages that follow a non-null cursor — include them or the trailing nulls are dropped.
            addOrCriteria(query,
                    pastSortValue,
                    sameSortValuePastId,
                    Criteria.where(sortField).is(null)
            );
        } else {
            addOrCriteria(query,
                    pastSortValue,
                    sameSortValuePastId
            );
        }
    }

    /**
     * Adds a top-level {@code $or} to the query. The base device query already occupies the
     * single null-key slot with its {@code $and}, and {@link Query#addCriteria} rejects a
     * second key-less criteria — so the alternatives are pre-serialised under an explicit
     * {@code $or} key instead of {@code new Criteria().orOperator(...)}.
     */
    private static void addOrCriteria(Query query, Criteria... alternatives) {
        List<Document> branches = Stream.of(alternatives)
                .map(Criteria::getCriteriaObject)
                .toList();
        query.addCriteria(Criteria.where("$or").is(branches));
    }

    private Object getSortFieldValue(Machine machine, String sortField) {
        return switch (sortField) {
            case "hostname" -> machine.getHostname();
            case "displayName" -> machine.getDisplayName();
            case "nickname" -> machine.getNickname();
            case "status" -> machine.getStatus() != null ? machine.getStatus().name() : null;
            case "lastSeen" -> machine.getLastSeen();
            default -> null;
        };
    }

    @Override
    public long countMachines(String tenantId, MachineQueryFilter filter, String search) {
        Query query = buildTenantQuery(tenantId, filter, search);
        return mongoTemplate.count(query, Machine.class);
    }

    @Override
    public List<String> findMachineIds(String tenantId, MachineQueryFilter filter, String search) {
        Query query = buildTenantQuery(tenantId, filter, search);
        return mongoTemplate.findDistinct(query, MACHINE_ID_FIELD, Machine.class, String.class);
    }

    @Override
    public List<Machine> findMachinesWithCursor(String tenantId, MachineQueryFilter filter, String search,
                                                String cursor, int limit,
                                                String sortField, String sortDirection) {
        Query query = buildTenantQuery(tenantId, filter, search);
        return findMachinesWithCursor(query, cursor, limit, sortField, sortDirection);
    }

    @Override
    public List<Machine> findAvailableForScheduleWithCursor(String tenantId, MachineQueryFilter filter, String search,
                                                            Collection<String> assignedMachineIds,
                                                            String cursor, int limit) {
        Query query = buildTenantQuery(tenantId, filter, search);
        return findAvailableForScheduleWithCursor(query, assignedMachineIds, cursor, limit);
    }

    @Override
    public Map<String, Integer> facet(String tenantId, MachineQueryFilter filter, String search,
                                      DeviceFacetDimension dimension) {
        String field = dimension.fieldName();
        Query query = buildTenantQuery(tenantId, filter, search, field);
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
                                                 Collection<OsType> osTypeScope) {
        return mongoTemplate.findDistinct(buildCriteriaQuery(tenantId, filter, osTypeScope),
                MACHINE_ID_FIELD, Machine.class, String.class);
    }

    @Override
    public long countMachinesByCriteria(String tenantId, MachineQueryFilter filter,
                                        Collection<OsType> osTypeScope) {
        return mongoTemplate.count(buildCriteriaQuery(tenantId, filter, osTypeScope), Machine.class);
    }

    private Query buildCriteriaQuery(String tenantId, MachineQueryFilter filter, Collection<OsType> osTypeScope) {
        Query query = buildTenantQuery(tenantId, filter, "");
        osTypeOrCriteria(osTypeScope).ifPresent(query::addCriteria);
        return query;
    }

    private Query buildTenantQuery(String tenantId, MachineQueryFilter filter, String search) {
        return buildTenantQuery(tenantId, filter, search, "");
    }

    private Query buildTenantQuery(String tenantId, MachineQueryFilter filter, String search, String excludeField) {
        Query query = buildDeviceQuery(filter, search, excludeField);
        withTenant(tenantId, query);
        if (hasTagFilters(filter)) {
            List<String> machineIds = resolveTaggedMachineIds(tenantId, filter);
            Criteria taggedMachines = Criteria.where(MACHINE_ID_FIELD).in(machineIds);
            query.addCriteria(taggedMachines);
        }
        return query;
    }

    private boolean hasTagFilters(MachineQueryFilter filter) {
        if (filter == null) {
            return false;
        }
        List<String> keys = filter.getTagKeys();
        List<String> values = filter.getTagValues();
        return !isEmpty(keys) || !isEmpty(values);
    }

    private List<String> resolveTaggedMachineIds(String tenantId, MachineQueryFilter filter) {
        List<String> keys = filter.getTagKeys();
        List<String> values = filter.getTagValues();
        Query query = deviceTagQuery(tenantId);
        if (!isEmpty(keys)) {
            List<String> tagIds = resolveTagIds(tenantId, keys);
            if (tagIds.isEmpty()) {
                return List.of();
            }
            Criteria tags = Criteria.where("tagId").in(tagIds);
            query.addCriteria(tags);
        }
        if (!isEmpty(values)) {
            Criteria matchingValues = Criteria.where("values").in(values);
            query.addCriteria(matchingValues);
        }
        List<TagAssignment> assignments = mongoTemplate.find(query, TagAssignment.class);
        return assignments.stream().map(TagAssignment::getEntityId).distinct().toList();
    }

    private List<String> resolveTagIds(String tenantId, List<String> keys) {
        Query query = deviceTagQuery(tenantId);
        Criteria matchingKeys = Criteria.where("key").in(keys);
        query.addCriteria(matchingKeys);
        List<Tag> tags = mongoTemplate.find(query, Tag.class);
        return tags.stream().map(Tag::getId).toList();
    }

    private Query deviceTagQuery(String tenantId) {
        Criteria deviceType = Criteria.where("entityType").is(TagEntityType.DEVICE);
        Query query = new Query(deviceType);
        return withTenant(tenantId, query);
    }

    Query buildDeviceQuery(MachineQueryFilter filter, String search) {
        return buildDeviceQuery(filter, search, null);
    }

    Query buildDeviceQuery(MachineQueryFilter filter, String search, String excludeField) {
        List<Criteria> criteriaList = new ArrayList<>();
        boolean statusExcluded = STATUS_FIELD.equals(excludeField);
        boolean callerConstrainsStatus = !statusExcluded && filter != null
                && filter.getStatuses() != null && !filter.getStatuses().isEmpty();
        boolean callerHidesStatuses = filter != null && filter.getExcludeStatuses() != null && !filter.getExcludeStatuses().isEmpty();
        if (!callerConstrainsStatus && !callerHidesStatuses) {
            criteriaList.add(Criteria.where("status").ne(DeviceStatus.DELETED));
        }
        if (callerHidesStatuses) {
            criteriaList.add(Criteria.where("status").nin(filter.getExcludeStatuses()));
        }

        if (filter != null) {
            if (!statusExcluded && filter.getStatuses() != null && !filter.getStatuses().isEmpty()) {
                criteriaList.add(Criteria.where("status").in(filter.getStatuses()));
            }
            if (!TYPE_FIELD.equals(excludeField)
                    && filter.getDeviceTypes() != null && !filter.getDeviceTypes().isEmpty()) {
                criteriaList.add(Criteria.where("type").in(filter.getDeviceTypes()));
            }
            if (!OS_TYPE_FIELD.equals(excludeField)) {
                osTypeOrCriteria(filter.getOsTypes()).ifPresent(criteriaList::add);
            }
            if (!ORGANIZATION_ID_FIELD.equals(excludeField)
                    && filter.getOrganizationIds() != null && !filter.getOrganizationIds().isEmpty()) {
                criteriaList.add(Criteria.where("organizationId").in(filter.getOrganizationIds()));
            }
            Collection<String> restrict = filter.getRestrictToMachineIds();
            if (restrict != null) {
                if (restrict.isEmpty()) {
                    criteriaList.add(Criteria.where(MACHINE_ID_FIELD).exists(false));
                } else {
                    criteriaList.add(Criteria.where(MACHINE_ID_FIELD).in(restrict));
                }
            }
            Collection<PackageManagerType> manageableBy = filter.getManageableByPackageManagers();
            if (manageableBy != null) {
                criteriaList.add(softwareManageableCriteria(manageableBy));
            }
            addNameCriteria(criteriaList, filter);
        }

        if (search != null && !search.isEmpty()) {
            String quoted = Pattern.quote(search);
            criteriaList.add(new Criteria().orOperator(
                    Criteria.where("hostname").regex(quoted, "i"),
                    Criteria.where("displayName").regex(quoted, "i"),
                    Criteria.where("nickname").regex(quoted, "i"),
                    Criteria.where("ip").regex(quoted, "i"),
                    Criteria.where("serialNumber").regex(quoted, "i"),
                    Criteria.where("manufacturer").regex(quoted, "i"),
                    Criteria.where("model").regex(quoted, "i")
            ));
        }

        Query query = new Query();
        if (!criteriaList.isEmpty()) {
            query.addCriteria(new Criteria().andOperator(criteriaList.toArray(new Criteria[0])));
        }
        return query;
    }

    private void addNameCriteria(List<Criteria> criteriaList, MachineQueryFilter filter) {
        List<Criteria> exactNames = exactNameCriteria(filter);
        if (!exactNames.isEmpty()) {
            Criteria[] alternatives = exactNames.toArray(Criteria[]::new);
            Criteria nameCriteria = new Criteria().orOperator(alternatives);
            criteriaList.add(nameCriteria);
            return;
        }
        String pattern = filter.getPattern();
        if (hasText(pattern)) {
            String regex = toNameRegex(pattern);
            Criteria names = namePatternCriteria(regex);
            criteriaList.add(names);
        }
    }

    private List<Criteria> exactNameCriteria(MachineQueryFilter filter) {
        List<String> hostnames = filter.getHostnames();
        List<String> nicknames = filter.getNicknames();
        Stream<Criteria> hosts = exactNameCriterion("hostname", hostnames);
        Stream<Criteria> aliases = exactNameCriterion("nickname", nicknames);
        Stream<Criteria> displayNames = exactNameCriterion("displayName", nicknames);
        Stream<Criteria> visibleNames = Stream.concat(aliases, displayNames);
        return Stream.concat(hosts, visibleNames).toList();
    }

    private Stream<Criteria> exactNameCriterion(String field, List<String> names) {
        if (isEmpty(names)) {
            return Stream.empty();
        }
        Collector<CharSequence, ?, String> alternatives = joining("|", "\\A(?:", ")\\z");
        String regex = names.stream().map(Pattern::quote).collect(alternatives);
        Criteria criterion = Criteria.where(field).regex(regex, "i");
        return Stream.of(criterion);
    }

    private Criteria namePatternCriteria(String regex) {
        Criteria hostname = Criteria.where("hostname").regex(regex, "i");
        Criteria nickname = Criteria.where("nickname").regex(regex, "i");
        Criteria displayName = Criteria.where("displayName").regex(regex, "i");
        return new Criteria().orOperator(hostname, nickname, displayName);
    }

    private String toNameRegex(String pattern) {
        String trimmed = pattern.trim();
        boolean hasWildcard = trimmed.indexOf('*') >= 0 || trimmed.indexOf('?') >= 0;
        if (hasWildcard) {
            String regex = trimmed.replace(".", "\\.").replace("*", ".*").replace("?", ".");
            return "^" + regex + "$";
        }
        return Pattern.quote(trimmed);
    }

    @Override
    public void updateLastSeen(String machineId, Instant lastSeen) {
        Query query = new Query(Criteria.where(MACHINE_ID_FIELD).is(machineId));
        mongoTemplate.updateFirst(query, new Update().set(LAST_SEEN_FIELD, lastSeen), Machine.class);
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE_FIELDS.contains(field.trim());
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT_FIELD;
    }

    private static Optional<Criteria> osTypeOrCriteria(Collection<OsType> osTypeScope) {
        List<OsType> valid = osTypeScope == null ? List.of() : osTypeScope.stream().filter(Objects::nonNull).toList();
        return valid.isEmpty() ? Optional.empty()
                : Optional.of(Criteria.where(OS_TYPE_FIELD).in(valid));
    }

    private static Criteria softwareManageableCriteria(Collection<PackageManagerType> manageableBy) {
        List<Criteria> anyManageable = new ArrayList<>();
        anyManageable.add(Criteria.where(PACKAGE_MANAGERS_FIELD).exists(false));
        manageableBy.forEach(manager -> anyManageable.add(
                Criteria.where(PACKAGE_MANAGERS_FIELD + "." + manager.name()).in(PackageManagerState.MANAGEABLE)));
        return new Criteria().orOperator(anyManageable.toArray(new Criteria[0]));
    }

}
