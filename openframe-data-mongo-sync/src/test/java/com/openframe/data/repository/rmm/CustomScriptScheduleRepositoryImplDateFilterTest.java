package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class CustomScriptScheduleRepositoryImplDateFilterTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptScheduleRepositoryImpl repo = new CustomScriptScheduleRepositoryImpl(mongoTemplate);

    private Document countQueryFor(ScriptScheduleQueryFilter filter) {
        repo.countForTenant("tenant-1", filter, null);
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(ScriptSchedule.class));
        return captor.getValue().getQueryObject();
    }

    @Test
    void createdAtRange_appliesInclusiveGteLte() {
        Instant from = Instant.parse("2026-01-01T00:00:00Z");
        Instant to = Instant.parse("2026-02-01T00:00:00Z");

        Document createdAt = (Document) countQueryFor(ScriptScheduleQueryFilter.builder()
                .createdAtFrom(from).createdAtTo(to).build()).get("createdAt");

        assertThat(createdAt).isNotNull();
        assertThat(createdAt.get("$gte")).isEqualTo(from);
        assertThat(createdAt.get("$lte")).isEqualTo(to);
    }

    @Test
    void updatedAtRange_openEnded_onlyLowerBound() {
        Instant from = Instant.parse("2026-03-01T00:00:00Z");

        Document updatedAt = (Document) countQueryFor(ScriptScheduleQueryFilter.builder()
                .updatedAtFrom(from).build()).get("updatedAt");

        assertThat(updatedAt).containsKey("$gte");
        assertThat(updatedAt).doesNotContainKey("$lte");
    }

    @Test
    void noDateFilter_addsNoDateCriteria() {
        Document q = countQueryFor(ScriptScheduleQueryFilter.builder().build());

        assertThat(q).doesNotContainKey("createdAt");
        assertThat(q).doesNotContainKey("updatedAt");
    }
}
