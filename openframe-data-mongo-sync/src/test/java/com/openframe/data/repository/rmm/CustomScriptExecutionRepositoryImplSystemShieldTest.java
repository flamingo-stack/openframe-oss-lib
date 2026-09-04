package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ScriptExecution;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomScriptExecutionRepositoryImplSystemShieldTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String SCRIPT_ID = "sc-1";

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptExecutionRepositoryImpl repo = new CustomScriptExecutionRepositoryImpl(mongoTemplate);

    private static Document sourceClause(Document queryObject) {
        Object node = queryObject.get("source");
        return node instanceof Document doc ? doc : null;
    }

    @Test
    @DisplayName("findPage: default query carries the source-shield ($ne SYSTEM_BOOTSTRAP) — bootstrap executions are hidden from user History")
    void findPage_shieldsBootstrapExecutions() {
        when(mongoTemplate.find(any(Query.class), eq(ScriptExecution.class))).thenReturn(List.of());

        repo.findPage(TENANT_ID, ExecutionOwnerScope.forScript(SCRIPT_ID), null,
                "_id", Sort.Direction.DESC, null, false, 10, null);

        Query captured = captureFind();
        Document sourceClause = sourceClause(captured.getQueryObject());
        assertThat(sourceClause).isNotNull();
        assertThat(sourceClause.get("$ne")).isEqualTo(ExecutionSource.SYSTEM_BOOTSTRAP);
    }

    @Test
    @DisplayName("count: the count query gets the same shield — count agrees with the list, bootstrap rows never inflate the total")
    void count_shieldsBootstrapExecutions() {
        when(mongoTemplate.count(any(Query.class), eq(ScriptExecution.class))).thenReturn(0L);

        repo.count(TENANT_ID, ExecutionOwnerScope.forScript(SCRIPT_ID), null, null);

        Query captured = captureCount();
        Document sourceClause = sourceClause(captured.getQueryObject());
        assertThat(sourceClause).isNotNull();
        assertThat(sourceClause.get("$ne")).isEqualTo(ExecutionSource.SYSTEM_BOOTSTRAP);
    }

    private Query captureFind() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(ScriptExecution.class));
        return captor.getValue();
    }

    private Query captureCount() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(ScriptExecution.class));
        return captor.getValue();
    }
}
