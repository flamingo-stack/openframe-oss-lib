package com.openframe.data.integration.support;

import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Wraps {@code explain("executionStats")} for find / upsert commands and exposes
 * the assertion DSL the perf IT actually uses. Walks the whole plan tree so multi-branch
 * {@code $or} plans (one IXSCAN per branch) can't slip through with a single-stage check.
 *
 * <p>The helper duplicates the {@link Query} that production code builds; tests must
 * keep the two in sync. The alternative — capturing the wire query via the profiler —
 * introduces shared state that makes parallel tests fragile.
 */
public final class MongoExplain {

    private MongoExplain() {
    }

    public static Stats explainFind(MongoTemplate template, String collection, Query query) {
        Document explainBody = new Document("find", collection)
                .append("filter", query.getQueryObject());

        Document sort = query.getSortObject();
        if (sort != null && !sort.isEmpty()) {
            explainBody.append("sort", sort);
        }
        Document projection = query.getFieldsObject();
        if (projection != null && !projection.isEmpty()) {
            explainBody.append("projection", projection);
        }
        if (query.getLimit() > 0) {
            explainBody.append("limit", query.getLimit());
        }

        Document command = new Document("explain", explainBody)
                .append("verbosity", "executionStats");
        return Stats.parse(template.getDb().runCommand(command));
    }

    public static Stats explainUpsert(MongoTemplate template, String collection, Query query, Update update) {
        Document updateOp = new Document("q", query.getQueryObject())
                .append("u", update.getUpdateObject())
                .append("upsert", true)
                .append("multi", false);

        Document command = new Document("explain",
                new Document("update", collection).append("updates", List.of(updateOp)))
                .append("verbosity", "executionStats");
        return Stats.parse(template.getDb().runCommand(command));
    }

    public static final class Stats {

        private final Document raw;
        private final List<Document> accessNodes;
        private final long keysExamined;
        private final long executionTimeMillis;

        private Stats(Document raw, List<Document> accessNodes, long keysExamined, long executionTimeMillis) {
            this.raw = raw;
            this.accessNodes = accessNodes;
            this.keysExamined = keysExamined;
            this.executionTimeMillis = executionTimeMillis;
        }

        private static Stats parse(Document explainResult) {
            Document execStats = (Document) explainResult.get("executionStats");
            if (execStats == null) {
                throw new IllegalStateException(
                        "explain result missing executionStats — was verbosity not 'executionStats'? "
                                + explainResult.toJson());
            }

            Document queryPlanner = (Document) explainResult.get("queryPlanner");
            Document winningPlan = queryPlanner == null ? null : (Document) queryPlanner.get("winningPlan");
            // Mongo 7 SBE wraps the plan tree under queryPlan.
            if (winningPlan != null && winningPlan.get("queryPlan") instanceof Document qp) {
                winningPlan = qp;
            }

            List<Document> nodes = new ArrayList<>();
            collectAccessNodes(winningPlan, nodes);

            return new Stats(
                    explainResult,
                    nodes,
                    requireLong(execStats, "totalKeysExamined", explainResult),
                    requireLong(execStats, "executionTimeMillis", explainResult));
        }

        private static void collectAccessNodes(Document plan, List<Document> sink) {
            if (plan == null) {
                return;
            }
            String stage = plan.getString("stage");
            if ("IXSCAN".equals(stage) || "COLLSCAN".equals(stage)) {
                sink.add(plan);
                return;
            }
            Object input = plan.get("inputStage");
            if (input instanceof Document doc) {
                collectAccessNodes(doc, sink);
            }
            Object inputs = plan.get("inputStages");
            if (inputs instanceof List<?> list) {
                for (Object child : list) {
                    if (child instanceof Document childDoc) {
                        collectAccessNodes(childDoc, sink);
                    }
                }
            }
        }

        private static long requireLong(Document doc, String key, Document fullResult) {
            Object v = doc.get(key);
            if (v instanceof Number n) {
                return n.longValue();
            }
            throw new IllegalStateException(
                    "explain result missing numeric '" + key + "' — full result: " + fullResult.toJson());
        }

        public Stats assertNoCollectionScan() {
            assertThat(scanStages())
                    .as("no leaf stage should be COLLSCAN — full scan defeats the index. Plan: %s", raw.toJson())
                    .doesNotContain("COLLSCAN");
            return this;
        }

        public Stats assertUsesIndex(String expectedName) {
            assertThat(indexNames())
                    .as("expected at least one IXSCAN on '%s'. Plan: %s", expectedName, raw.toJson())
                    .contains(expectedName);
            return this;
        }

        public Stats assertExaminedAtMost(long maxKeys) {
            assertThat(keysExamined)
                    .as("totalKeysExamined should be ≤ %d but was %d. Plan: %s",
                            maxKeys, keysExamined, raw.toJson())
                    .isLessThanOrEqualTo(maxKeys);
            return this;
        }

        public Stats assertExecutionTimeBelow(long maxMillis) {
            assertThat(executionTimeMillis)
                    .as("executionTimeMillis should be < %d but was %d. Plan: %s",
                            maxMillis, executionTimeMillis, raw.toJson())
                    .isLessThan(maxMillis);
            return this;
        }

        private List<String> scanStages() {
            return accessNodes.stream().map(d -> d.getString("stage")).toList();
        }

        private List<String> indexNames() {
            return accessNodes.stream()
                    .map(d -> d.getString("indexName"))
                    .filter(java.util.Objects::nonNull)
                    .toList();
        }
    }
}
