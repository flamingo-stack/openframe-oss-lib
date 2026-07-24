package com.openframe.stream.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.ScriptExecution;
import com.mongodb.client.result.UpdateResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * Rolls up leaf {@link ScriptExecution} rows into the {@link ScheduleScriptExecution}
 * header for a single schedule fire, invoked from
 * {@link com.openframe.stream.handler.ScriptExecutionStatusUpdateHandler} after each leaf
 * transitions to a terminal status.
 *
 * <p>Semantics:
 * <ul>
 *   <li>Any leaf still {@code RUNNING} → header stays {@code RUNNING}, no-op.</li>
 *   <li>Every leaf terminal AND at least one {@code FAILED} → header {@code FAILED}.</li>
 *   <li>Every leaf terminal AND none failed → header {@code SUCCESS}.</li>
 * </ul>
 *
 * <p>The final transition is an atomic conditional update ({@code status = RUNNING → X}),
 * so N leaves that finish concurrently and all decide "I'm the last" cannot double-write:
 * whoever's update lands first flips the header, the rest see {@code modifiedCount == 0}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleScriptExecutionAggregator {

    private final MongoTemplate mongoTemplate;

    /**
     * Recompute the header status for the given fire after one of its leaves just
     * finished. Safe to call on every leaf transition (idempotent + short-circuits
     * when leaves are still running).
     */
    public void aggregate(String tenantId, String executionId) {
        if (tenantId == null || executionId == null) {
            return;
        }

        StatusTally tally = tallyLeaves(tenantId, executionId);
        if (tally.running() > 0) {
            return;
        }

        ExecutionStatus finalStatus = tally.failed() > 0 ? ExecutionStatus.FAILED : ExecutionStatus.SUCCESS;
        Query onlyIfStillRunning = Query.query(Criteria.where("tenantId").is(tenantId)
                .and("executionId").is(executionId)
                .and("status").is(ExecutionStatus.RUNNING));
        Update transition = new Update()
                .set("status", finalStatus)
                .set("finishedAt", Instant.now());

        UpdateResult result = mongoTemplate.updateFirst(onlyIfStillRunning, transition, ScheduleScriptExecution.class);
        if (result.getModifiedCount() > 0) {
            log.info("Transitioned schedule fire header: executionId={} status=RUNNING→{} tenantId={}",
                    executionId, finalStatus, tenantId);
        }
    }

    /**
     * Single {@code $group} over the leaves — cheap, tenant-scoped by the compound index.
     * Returns zero counts when no leaves exist (missing/orphan fire), which then decides
     * SUCCESS by fall-through — harmless: the header conditional update will no-op if it
     * has been reaped or was never created.
     */
    private StatusTally tallyLeaves(String tenantId, String executionId) {
        Aggregation agg = Aggregation.newAggregation(
                Aggregation.match(Criteria.where("tenantId").is(tenantId).and("executionId").is(executionId)),
                Aggregation.group("status").count().as("count"));
        AggregationResults<Document> groups = mongoTemplate.aggregate(agg, ScriptExecution.class, Document.class);

        long running = 0;
        long failed = 0;
        for (Document g : groups.getMappedResults()) {
            Object rawStatus = g.get("_id");
            if (rawStatus == null) {
                continue;
            }
            long count = ((Number) g.get("count")).longValue();
            String status = rawStatus.toString();
            if (ExecutionStatus.RUNNING.name().equals(status)) {
                running = count;
            } else if (ExecutionStatus.FAILED.name().equals(status)) {
                failed = count;
            }
        }
        return new StatusTally(running, failed);
    }

    private record StatusTally(long running, long failed) {}
}
