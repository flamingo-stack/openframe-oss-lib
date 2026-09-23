package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.filter.SoftwareActionQueryFilter;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareActionSummary;
import lombok.RequiredArgsConstructor;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Repository
@RequiredArgsConstructor
public class SoftwareActionAggregationRepositoryImpl implements SoftwareActionAggregationRepository {

    private static final String SCRIPT_EXECUTIONS = "script_executions";
    private static final List<String> TERMINAL = List.of(ExecutionStatus.SUCCESS.name(), ExecutionStatus.FAILED.name());
    private static final List<String> IN_PROGRESS = List.of(ExecutionStatus.QUEUED.name(), ExecutionStatus.RUNNING.name());
    private static final String DEFAULT_SORT = "dispatchedAt";
    private static final Set<String> SORTABLE = Set.of("dispatchedAt", "status", "packageName", "totalMachineCount");

    private final MongoTemplate mongoTemplate;

    @Override
    public List<SoftwareActionSummary> findPage(String tenantId, SoftwareActionQueryFilter filter, String search,
                                                String sortField, Sort.Direction direction, int skip, int limit) {
        List<AggregationOperation> stages = new ArrayList<>(pipeline(tenantId, filter, search));
        String sort = SORTABLE.contains(sortField) ? sortField : DEFAULT_SORT;
        int dir = direction == Sort.Direction.ASC ? 1 : -1;
        stages.add(ctx -> new Document("$sort", new Document(sort, dir).append("executionId", 1)));
        stages.add(ctx -> new Document("$skip", (long) Math.max(0, skip)));
        stages.add(ctx -> new Document("$limit", limit));

        return aggregate(stages).getMappedResults().stream()
                .map(SoftwareActionAggregationRepositoryImpl::toSummary).toList();
    }

    @Override
    public long count(String tenantId, SoftwareActionQueryFilter filter, String search) {
        List<AggregationOperation> stages = new ArrayList<>(pipeline(tenantId, filter, search));
        stages.add(ctx -> new Document("$count", "total"));
        Document doc = aggregate(stages).getUniqueMappedResult();
        return doc == null ? 0 : ((Number) doc.get("total")).longValue();
    }

    @Override
    public Map<String, Integer> facet(String tenantId, SoftwareActionQueryFilter filter, String search, String field) {
        List<AggregationOperation> stages = new ArrayList<>(pipeline(tenantId, filter, search));
        stages.add(ctx -> new Document("$group", new Document("_id", "$" + field).append("count", new Document("$sum", 1))));
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (Document doc : aggregate(stages).getMappedResults()) {
            Object id = doc.get("_id");
            if (id != null) {
                counts.put(id.toString(), intValue(doc.get("count")));
            }
        }
        return counts;
    }

    @Override
    public Optional<SoftwareActionSummary> findByExecutionId(String tenantId, String executionId) {
        List<AggregationOperation> stages = new ArrayList<>();
        stages.add(ctx -> new Document("$match", new Document("tenantId", tenantId).append("executionId", executionId)));
        stages.add(ctx -> lookupExecutions());
        stages.addAll(reconcileStages());
        stages.add(ctx -> new Document("$project", projectDoc()));
        List<Document> docs = aggregate(stages).getMappedResults();
        return docs.isEmpty() ? Optional.empty() : Optional.of(toSummary(docs.get(0)));
    }

    @Override
    public boolean isSortableField(String field) {
        return field != null && SORTABLE.contains(field);
    }

    @Override
    public String getDefaultSortField() {
        return DEFAULT_SORT;
    }

    private AggregationResults<Document> aggregate(List<AggregationOperation> stages) {
        return mongoTemplate.aggregate(Aggregation.newAggregation(stages), SoftwareActionResult.class, Document.class);
    }

    private static List<AggregationOperation> pipeline(String tenantId, SoftwareActionQueryFilter filter, String search) {
        List<AggregationOperation> stages = new ArrayList<>();
        stages.add(ctx -> new Document("$match", matchDoc(tenantId, filter, search)));
        stages.add(ctx -> lookupExecutions());
        stages.addAll(reconcileStages());
        stages.add(ctx -> new Document("$project", projectDoc()));
        stages.add(ctx -> new Document("$match", new Document("status",
                new Document("$ne", SoftwareActionStatus.SCHEDULED.name()))));
        List<String> statusNames = statusNames(filter);
        if (statusNames != null) {
            stages.add(ctx -> new Document("$match", new Document("status", new Document("$in", statusNames))));
        }
        return stages;
    }

    private static Document matchDoc(String tenantId, SoftwareActionQueryFilter filter, String search) {
        Document match = new Document("tenantId", tenantId);
        if (filter != null) {
            if (filter.getActions() != null && !filter.getActions().isEmpty()) {
                match.append("action", new Document("$in", names(filter.getActions())));
            }
            if (filter.getEngines() != null && !filter.getEngines().isEmpty()) {
                match.append("packageManager", new Document("$in", names(filter.getEngines())));
            }
        }
        if (StringUtils.hasText(search)) {
            match.append("packageName", new Document("$regex", Pattern.quote(search.trim())).append("$options", "i"));
        }
        return match;
    }

    private static Document lookupExecutions() {
        List<Object> subPipeline = List.of(
                new Document("$match", new Document("$expr", new Document("$and", List.of(
                        new Document("$eq", Arrays.asList("$executionId", "$$eid")),
                        new Document("$eq", Arrays.asList("$tenantId", "$$tid")),
                        new Document("$ne", Arrays.asList("$softwareAction", null)))))),
                new Document("$group", new Document("_id", null)
                        .append("responded", new Document("$addToSet", cond(inArr("$status", TERMINAL), "$machineId", null)))
                        .append("hasInProgress", new Document("$max", cond(inArr("$status", IN_PROGRESS), 1, 0)))
                        .append("failed", new Document("$max",
                                cond(new Document("$eq", Arrays.asList("$status", ExecutionStatus.FAILED.name())), 1, 0)))
                        .append("execCount", new Document("$sum", 1))));
        return new Document("$lookup", new Document("from", SCRIPT_EXECUTIONS)
                .append("let", new Document("eid", "$executionId").append("tid", "$tenantId"))
                .append("pipeline", subPipeline)
                .append("as", "exec"));
    }

    private static List<AggregationOperation> reconcileStages() {
        List<AggregationOperation> stages = new ArrayList<>();
        stages.add(ctx -> new Document("$addFields",
                new Document("_exec", new Document("$arrayElemAt", Arrays.asList("$exec", 0)))));
        Object hasLeaves = new Document("$gt", Arrays.asList(new Document("$ifNull", Arrays.asList("$_exec.execCount", 0)), 0));
        Object responded = new Document("$size", new Document("$setDifference", List.of(
                new Document("$ifNull", Arrays.asList("$_exec.responded", Collections.emptyList())),
                Collections.singletonList(null))));
        Object liveStatus = cond(new Document("$gt", Arrays.asList(new Document("$ifNull", Arrays.asList("$_exec.hasInProgress", 0)), 0)),
                SoftwareActionStatus.IN_PROGRESS.name(),
                cond(new Document("$gt", Arrays.asList(new Document("$ifNull", Arrays.asList("$_exec.failed", 0)), 0)),
                        SoftwareActionStatus.FAILED.name(), SoftwareActionStatus.COMPLETED.name()));
        stages.add(ctx -> new Document("$addFields", new Document()
                .append("respondedMachineCount", cond(hasLeaves, responded, 0))
                .append("status", cond(hasLeaves, liveStatus, "$status"))));
        return stages;
    }

    private static Document projectDoc() {
        return new Document("_id", 0)
                .append("executionId", 1)
                .append("packageManager", 1)
                .append("packageName", 1)
                .append("action", 1)
                .append("initiatedBy", 1)
                .append("bundleId", 1)
                .append("scheduleId", 1)
                .append("dispatchedAt", 1)
                .append("totalMachineCount", 1)
                .append("respondedMachineCount", 1)
                .append("status", 1);
    }

    private static Document inArr(Object value, List<String> arr) {
        return new Document("$in", Arrays.asList(value, arr));
    }

    private static Document cond(Object ifExpr, Object thenExpr, Object elseExpr) {
        return new Document("$cond", Arrays.asList(ifExpr, thenExpr, elseExpr));
    }

    private static List<String> statusNames(SoftwareActionQueryFilter filter) {
        if (filter == null || filter.getStatuses() == null || filter.getStatuses().isEmpty()) {
            return null;
        }
        List<String> names = new ArrayList<>();
        for (SoftwareActionStatus s : filter.getStatuses()) {
            if (s != SoftwareActionStatus.SCHEDULED) {
                names.add(s.name());
            }
        }
        return names;
    }

    private static <E extends Enum<E>> List<String> names(List<E> values) {
        return values.stream().map(Enum::name).toList();
    }

    private static SoftwareActionSummary toSummary(Document doc) {
        return SoftwareActionSummary.builder()
                .executionId(doc.getString("executionId"))
                .packageManager(enumOrNull(doc.getString("packageManager"), PackageManagerType.class))
                .packageName(doc.getString("packageName"))
                .action(enumOrNull(doc.getString("action"), SoftwareAction.class))
                .status(enumOrNull(doc.getString("status"), SoftwareActionStatus.class))
                .totalMachineCount(intValue(doc.get("totalMachineCount")))
                .respondedMachineCount(intValue(doc.get("respondedMachineCount")))
                .dispatchedAt(instantOrNull(doc.get("dispatchedAt")))
                .initiatedBy(doc.getString("initiatedBy"))
                .bundleId(doc.getString("bundleId"))
                .scheduleId(doc.getString("scheduleId"))
                .build();
    }

    private static <E extends Enum<E>> E enumOrNull(String value, Class<E> type) {
        return value == null ? null : Enum.valueOf(type, value);
    }

    private static int intValue(Object value) {
        return value instanceof Number n ? n.intValue() : 0;
    }

    private static Instant instantOrNull(Object value) {
        if (value instanceof Date date) {
            return date.toInstant();
        }
        return value instanceof Instant instant ? instant : null;
    }
}
