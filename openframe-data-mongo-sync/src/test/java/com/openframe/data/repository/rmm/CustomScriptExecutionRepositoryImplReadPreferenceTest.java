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
    @DisplayName("header aggregation (countLeavesByStatus) counts RUNNING then FAILED from PRIMARY, scoped to (tenant, execution)")
    void countLeavesByStatus_countsFromPrimary() {
        when(mongoTemplate.count(any(Query.class), eq(ScriptExecution.class))).thenReturn(2L, 1L);

        CustomScriptExecutionRepository.LeafStatusCounts counts = repo.countLeavesByStatus("tenant-1", "exec-1");

        assertThat(counts.running()).isEqualTo(2L);
        assertThat(counts.failed()).isEqualTo(1L);

        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate, times(2)).count(captor.capture(), eq(ScriptExecution.class));
        List<Query> queries = captor.getAllValues();
        assertThat(queries).allSatisfy(q -> assertThat(q.getReadPreference()).isEqualTo(ReadPreference.primary()));
        assertThat(queries.get(0).getQueryObject().get("status")).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(queries.get(1).getQueryObject().get("status")).isEqualTo(ExecutionStatus.FAILED);
        assertThat(queries.get(0).getQueryObject().get("tenantId")).isEqualTo("tenant-1");
        assertThat(queries.get(0).getQueryObject().get("executionId")).isEqualTo("exec-1");
    }
}
