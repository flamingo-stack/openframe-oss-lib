package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptType;
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

    /** The managed-script shield lives on the {@code type} field as {@code $nin [SYSTEM, SOFTWARE]}. */
    private static void assertShielded(Query query) {
        Object node = query.getQueryObject().get("type");
        assertThat(node).isInstanceOf(Document.class);
        Object nin = ((Document) node).get("$nin");
        assertThat(nin).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.list(Object.class))
                .containsExactlyInAnyOrder(ScriptType.SYSTEM, ScriptType.SOFTWARE);
    }

    @Test
    @DisplayName("findPageForTenant: default query carries the managed-script shield — bootstrap/software presets are excluded even without an opt-in")
    void findPageForTenant_shieldsManagedScripts() {
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());

        repo.findPageForTenant(TENANT_ID, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertShielded(captureFind());
    }

    @Test
    @DisplayName("countForTenant: the count query gets the same shield — count agrees with the list, presets never inflate the total")
    void countForTenant_shieldsManagedScripts() {
        when(mongoTemplate.count(any(Query.class), eq(Script.class))).thenReturn(0L);

        repo.countForTenant(TENANT_ID, null, null);

        assertShielded(captureCount());
    }

    @Test
    @DisplayName("findPageForTenant: an explicit ScriptQueryFilter does NOT lift the shield — a filter combination cannot resurrect a preset by accident")
    void findPageForTenant_filterDoesNotLiftShield() {
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());
        ScriptQueryFilter filter = new ScriptQueryFilter();
        filter.setStatuses(List.of(com.openframe.data.document.rmm.script.ScriptStatus.ACTIVE));

        repo.findPageForTenant(TENANT_ID, filter, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertShielded(captureFind());
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
