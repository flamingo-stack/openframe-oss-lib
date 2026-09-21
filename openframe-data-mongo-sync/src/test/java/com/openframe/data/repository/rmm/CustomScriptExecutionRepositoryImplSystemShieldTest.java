package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.filter.ExecutionOwnerScope;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
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

    private static ScriptExecutionQueryFilter serviceFilter() {
        return ScriptExecutionQueryFilter.builder()
                .excludedSources(List.of(ExecutionSource.SYSTEM_BOOTSTRAP))
                .build();
    }

    private static Document sourceClause(Document queryObject) {
        Object node = queryObject.get("source");
        return node instanceof Document doc ? doc : null;
    }

    @Test
    @DisplayName("findPage: the service-supplied exclusion lands as $nin — bootstrap executions are hidden from user History")
    void findPage_appliesServiceSuppliedSourceExclusion() {
        when(mongoTemplate.find(any(Query.class), eq(ScriptExecution.class))).thenReturn(List.of());

        repo.findPage(TENANT_ID, ExecutionOwnerScope.forScript(SCRIPT_ID), serviceFilter(),
                "_id", Sort.Direction.DESC, null, false, 10, null);

        Document sourceClause = sourceClause(captureFind().getQueryObject());
        assertThat(sourceClause).isNotNull();
        assertThat(sourceClause.get("$nin")).isEqualTo(List.of(ExecutionSource.SYSTEM_BOOTSTRAP));
    }

    @Test
    @DisplayName("count: the count query gets the same exclusion — count agrees with the list")
    void count_appliesServiceSuppliedSourceExclusion() {
        when(mongoTemplate.count(any(Query.class), eq(ScriptExecution.class))).thenReturn(0L);

        repo.count(TENANT_ID, ExecutionOwnerScope.forScript(SCRIPT_ID), serviceFilter(), null);

        Document sourceClause = sourceClause(captureCount().getQueryObject());
        assertThat(sourceClause).isNotNull();
        assertThat(sourceClause.get("$nin")).isEqualTo(List.of(ExecutionSource.SYSTEM_BOOTSTRAP));
    }

    @Test
    @DisplayName("the repository stays neutral: no filter — no source clause; which sources to hide is the service's call")
    void noFilter_noSourceClause() {
        when(mongoTemplate.find(any(Query.class), eq(ScriptExecution.class))).thenReturn(List.of());

        repo.findPage(TENANT_ID, ExecutionOwnerScope.forScript(SCRIPT_ID), null,
                "_id", Sort.Direction.DESC, null, false, 10, null);

        assertThat(sourceClause(captureFind().getQueryObject())).isNull();
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
