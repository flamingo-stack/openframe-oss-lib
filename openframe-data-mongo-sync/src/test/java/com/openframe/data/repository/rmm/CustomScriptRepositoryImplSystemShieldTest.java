package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.document.rmm.script.Script;
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

class CustomScriptRepositoryImplSystemShieldTest {

    private static final String TENANT_ID = "tenant-1";

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptRepositoryImpl repo = new CustomScriptRepositoryImpl(mongoTemplate);

    private static Document systemClause(Document queryObject) {
        Object node = queryObject.get("system");
        return node instanceof Document doc ? doc : null;
    }

    @Test
    @DisplayName("findPageForTenant: default query carries the system-shield ($ne true) — bootstrap presets are excluded even without an opt-in")
    void findPageForTenant_shieldsSystemScripts() {
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());

        repo.findPageForTenant(TENANT_ID, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        Query captured = captureFind();
        Document systemClause = systemClause(captured.getQueryObject());
        assertThat(systemClause).isNotNull();
        assertThat(systemClause.get("$ne")).isEqualTo(true);
    }

    @Test
    @DisplayName("countForTenant: the count query gets the same shield — count agrees with the list, presets never inflate the total")
    void countForTenant_shieldsSystemScripts() {
        when(mongoTemplate.count(any(Query.class), eq(Script.class))).thenReturn(0L);

        repo.countForTenant(TENANT_ID, null, null);

        Query captured = captureCount();
        Document systemClause = systemClause(captured.getQueryObject());
        assertThat(systemClause).isNotNull();
        assertThat(systemClause.get("$ne")).isEqualTo(true);
    }

    @Test
    @DisplayName("findPageForTenant: an explicit ScriptQueryFilter does NOT lift the shield — a filter combination cannot resurrect a preset by accident")
    void findPageForTenant_filterDoesNotLiftShield() {
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());
        ScriptQueryFilter filter = new ScriptQueryFilter();
        filter.setStatuses(List.of(com.openframe.data.document.rmm.script.ScriptStatus.ACTIVE));

        repo.findPageForTenant(TENANT_ID, filter, null, "_id", Sort.Direction.DESC, null, false, 10);

        Query captured = captureFind();
        Document systemClause = systemClause(captured.getQueryObject());
        assertThat(systemClause).isNotNull();
        assertThat(systemClause.get("$ne")).isEqualTo(true);
    }

    private Query captureFind() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(Script.class));
        return captor.getValue();
    }

    private Query captureCount() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(Script.class));
        return captor.getValue();
    }
}
