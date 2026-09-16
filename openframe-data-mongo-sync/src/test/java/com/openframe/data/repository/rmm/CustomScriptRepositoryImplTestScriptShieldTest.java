package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.script.Script;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomScriptRepositoryImplTestScriptShieldTest {

    private static final String TENANT_ID = "tenant-1";

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptRepositoryImpl repo = new CustomScriptRepositoryImpl(mongoTemplate);

    @Test
    @DisplayName("testMode=false (default): shield is inactive — no testScript clause on findPage query")
    void findPageForTenant_testModeDisabled_showsEverything() {
        setTestMode(false);
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());

        repo.findPageForTenant(TENANT_ID, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(captureFind().getQueryObject().containsKey("testScript"))
                .as("default (test-mode disabled) must not add the testScript shield — everything is visible")
                .isFalse();
    }

    @Test
    @DisplayName("testMode=true: shield adds testScript: {$ne: true} to findPage query")
    void findPageForTenant_testModeEnabled_shieldsTestScripts() {
        setTestMode(true);
        when(mongoTemplate.find(any(Query.class), eq(Script.class))).thenReturn(List.of());

        repo.findPageForTenant(TENANT_ID, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertTestScriptShielded(captureFind());
    }

    @Test
    @DisplayName("testMode=false (default): count query has no testScript clause")
    void countForTenant_testModeDisabled_showsEverything() {
        setTestMode(false);
        when(mongoTemplate.count(any(Query.class), eq(Script.class))).thenReturn(0L);

        repo.countForTenant(TENANT_ID, null, null);

        assertThat(captureCount().getQueryObject().containsKey("testScript"))
                .as("default (test-mode disabled) must not add the testScript shield to counts either")
                .isFalse();
    }

    @Test
    @DisplayName("testMode=true: count query gets the same shield — user count agrees with user list")
    void countForTenant_testModeEnabled_shieldsTestScripts() {
        setTestMode(true);
        when(mongoTemplate.count(any(Query.class), eq(Script.class))).thenReturn(0L);

        repo.countForTenant(TENANT_ID, null, null);

        assertTestScriptShielded(captureCount());
    }

    private void setTestMode(boolean enabled) {
        ReflectionTestUtils.setField(repo, "testModeEnabled", enabled);
    }

    private static void assertTestScriptShielded(Query query) {
        Object node = query.getQueryObject().get("testScript");
        assertThat(node).isInstanceOf(Document.class);
        assertThat(((Document) node).get("$ne")).isEqualTo(true);
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
