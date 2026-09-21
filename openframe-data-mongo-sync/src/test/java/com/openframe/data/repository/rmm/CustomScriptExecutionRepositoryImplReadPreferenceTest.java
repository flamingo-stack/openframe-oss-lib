package com.openframe.data.repository.rmm;

import com.mongodb.ReadPreference;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomScriptExecutionRepositoryImplReadPreferenceTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptExecutionRepositoryImpl repo = new CustomScriptExecutionRepositoryImpl(mongoTemplate);

    @Test
    @DisplayName("result correlation (findBy machine+execution+script) reads from PRIMARY, scoped to the three keys")
    void findLeafForResult_readsFromPrimary() {
        when(mongoTemplate.findOne(any(Query.class), eq(ScriptExecution.class))).thenReturn(null);

        repo.findByMachineIdAndExecutionIdAndScriptId("m-1", "exec-1", "script-1");

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).findOne(captor.capture(), eq(ScriptExecution.class));
        Query q = captor.getValue();
        assertThat(q.getReadPreference()).isEqualTo(ReadPreference.primary());
        Document qo = q.getQueryObject();
        assertThat(qo.get("machineId")).isEqualTo("m-1");
        assertThat(qo.get("executionId")).isEqualTo("exec-1");
        assertThat(qo.get("scriptId")).isEqualTo("script-1");
    }

    @Test
    @DisplayName("batch ack lookup (findBy machine+execution+scriptId IN) reads from PRIMARY, scoped to the delivery + scriptIds")
    void findLeavesForAck_readsFromPrimary() {
        when(mongoTemplate.find(any(Query.class), eq(ScriptExecution.class))).thenReturn(List.of());

        repo.findByMachineIdAndExecutionIdAndScriptIdIn("m-1", "exec-1", List.of("script-1", "script-2"));

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(ScriptExecution.class));
        Query q = captor.getValue();
        assertThat(q.getReadPreference()).isEqualTo(ReadPreference.primary());
        Document qo = q.getQueryObject();
        assertThat(qo.get("machineId")).isEqualTo("m-1");
        assertThat(qo.get("executionId")).isEqualTo("exec-1");
        assertThat(((Document) qo.get("scriptId")).get("$in")).isEqualTo(List.of("script-1", "script-2"));
    }

    @Test
    @DisplayName("batch ack lookup short-circuits to empty on empty scriptIds — no Mongo query")
    void findLeavesForAck_emptyScriptIds_shortCircuits() {
        assertThat(repo.findByMachineIdAndExecutionIdAndScriptIdIn("m-1", "exec-1", List.of())).isEmpty();
        verify(mongoTemplate, org.mockito.Mockito.never()).find(any(Query.class), eq(ScriptExecution.class));
    }

    @Test
    @DisplayName("header aggregation (countLeavesByStatus) counts QUEUED + RUNNING (in-progress) then FAILED from PRIMARY, scoped to (tenant, execution)")
    void countLeavesByStatus_countsFromPrimary() {
        when(mongoTemplate.count(any(Query.class), eq(ScriptExecution.class))).thenReturn(2L, 3L, 1L);   // QUEUED, RUNNING, FAILED

        CustomScriptExecutionRepository.LeafStatusCounts counts = repo.countLeavesByStatus("tenant-1", "exec-1");

        assertThat(counts.inProgress()).isEqualTo(5L);   // in-progress = QUEUED(2) + RUNNING(3)
        assertThat(counts.failed()).isEqualTo(1L);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate, times(3)).count(captor.capture(), eq(ScriptExecution.class));
        List<Query> queries = captor.getAllValues();
        assertThat(queries).allSatisfy(q -> assertThat(q.getReadPreference()).isEqualTo(ReadPreference.primary()));
        assertThat(queries.get(0).getQueryObject().get("status")).isEqualTo(ExecutionStatus.QUEUED);
        assertThat(queries.get(1).getQueryObject().get("status")).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(queries.get(2).getQueryObject().get("status")).isEqualTo(ExecutionStatus.FAILED);
        assertThat(queries.get(0).getQueryObject().get("tenantId")).isEqualTo("tenant-1");
        assertThat(queries.get(0).getQueryObject().get("executionId")).isEqualTo("exec-1");
    }
}
