package com.openframe.stream.service;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.ScriptExecution;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Locks the header-aggregation contract: leaves-still-running is a no-op, all-terminal
 * decides SUCCESS/FAILED by the presence of any FAILED leaf, and the header update is
 * conditional on {@code status = RUNNING} (idempotent under concurrent last-leaf races).
 */
@ExtendWith(MockitoExtension.class)
class ScheduleScriptExecutionAggregatorTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-1";

    @Mock private MongoTemplate mongoTemplate;

    private ScheduleScriptExecutionAggregator aggregator;

    @BeforeEach
    void setUp() {
        aggregator = new ScheduleScriptExecutionAggregator(mongoTemplate);
    }

    @Test
    @DisplayName("any leaf still RUNNING → header untouched (updateFirst never called)")
    void anyLeafRunning_shortCircuits() {
        stubLeafStatusCounts(List.of(group(ExecutionStatus.RUNNING, 2), group(ExecutionStatus.SUCCESS, 3)));

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);

        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(ScheduleScriptExecution.class));
    }

    @Test
    @DisplayName("all leaves terminal, none failed → header conditionally transitioned to SUCCESS with finishedAt set")
    void allTerminalNoFailed_transitionsToSuccess() {
        stubLeafStatusCounts(List.of(group(ExecutionStatus.SUCCESS, 4)));
        stubHeaderUpdate(1);

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);

        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).updateFirst(query.capture(), update.capture(), eq(ScheduleScriptExecution.class));

        // Guard on RUNNING → makes it idempotent when N leaves finish concurrently.
        Document queryObj = query.getValue().getQueryObject();
        assertThat(queryObj.getString("tenantId")).isEqualTo(TENANT_ID);
        assertThat(queryObj.getString("executionId")).isEqualTo(EXECUTION_ID);
        assertThat(queryObj.get("status")).isEqualTo(ExecutionStatus.RUNNING);

        Document set = (Document) update.getValue().getUpdateObject().get("$set");
        assertThat(set.get("status")).isEqualTo(ExecutionStatus.SUCCESS);
        assertThat(set.get("finishedAt")).isNotNull();
    }

    @Test
    @DisplayName("all leaves terminal, any FAILED → header transitioned to FAILED (a single failing leaf poisons the whole fire)")
    void allTerminalAnyFailed_transitionsToFailed() {
        stubLeafStatusCounts(List.of(group(ExecutionStatus.SUCCESS, 3), group(ExecutionStatus.FAILED, 1)));
        stubHeaderUpdate(1);

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);

        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate).updateFirst(any(Query.class), update.capture(), eq(ScheduleScriptExecution.class));
        Document set = (Document) update.getValue().getUpdateObject().get("$set");
        assertThat(set.get("status")).isEqualTo(ExecutionStatus.FAILED);
    }

    @Test
    @DisplayName("header already terminal (concurrent last-leaf race) → updateFirst returns 0 modified, aggregator returns cleanly")
    void headerAlreadyTerminal_noOpModify() {
        stubLeafStatusCounts(List.of(group(ExecutionStatus.SUCCESS, 3)));
        stubHeaderUpdate(0);   // conditional guard says "already terminal"

        aggregator.aggregate(TENANT_ID, EXECUTION_ID);   // must not throw

        verify(mongoTemplate).updateFirst(any(Query.class), any(Update.class), eq(ScheduleScriptExecution.class));
    }

    @Test
    @DisplayName("null tenantId or executionId → completely no-op")
    void nulls_areNoOp() {
        aggregator.aggregate(null, EXECUTION_ID);
        aggregator.aggregate(TENANT_ID, null);
        verify(mongoTemplate, never()).aggregate(any(Aggregation.class), any(Class.class), any(Class.class));
        verify(mongoTemplate, never()).updateFirst(any(Query.class), any(Update.class), eq(ScheduleScriptExecution.class));
    }

    // --- helpers ------------------------------------------------------------

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void stubLeafStatusCounts(List<Document> groups) {
        AggregationResults<Document> results = mock(AggregationResults.class);
        when(results.getMappedResults()).thenReturn(groups);
        when(mongoTemplate.aggregate(any(Aggregation.class), eq(ScriptExecution.class), eq(Document.class)))
                .thenReturn(results);
    }

    private void stubHeaderUpdate(long modified) {
        UpdateResult r = mock(UpdateResult.class);
        when(r.getModifiedCount()).thenReturn(modified);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(ScheduleScriptExecution.class)))
                .thenReturn(r);
    }

    private static Document group(ExecutionStatus status, long count) {
        return new Document("_id", status.name()).append("count", count);
    }
}
