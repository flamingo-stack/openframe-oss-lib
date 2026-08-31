package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleScript;
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

class CustomScheduleScriptRepositoryImplDateFilterTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptScheduleRepositoryImpl repo = new CustomScriptScheduleRepositoryImpl(mongoTemplate);

    private Document countQueryFor(ScriptScheduleQueryFilter filter) {
        repo.countForTenant("tenant-1", filter, null);
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).count(captor.capture(), eq(ScheduleScript.class));
        return captor.getValue().getQueryObject();
    }

    @Test
    void startAtRange_appliesInclusiveGteLte() {
        Instant from = Instant.parse("2026-04-01T00:00:00Z");
        Instant to = Instant.parse("2026-05-01T00:00:00Z");

        Document startAt = (Document) countQueryFor(ScriptScheduleQueryFilter.builder()
                .startAtFrom(from).startAtTo(to).build()).get("startAt");

        assertThat(startAt).isNotNull();
        assertThat(startAt.get("$gte")).isEqualTo(from);
        assertThat(startAt.get("$lte")).isEqualTo(to);
    }

    @Test
    void startAtRange_openEnded_onlyLowerBound() {
        Instant from = Instant.parse("2026-04-01T00:00:00Z");

        Document startAt = (Document) countQueryFor(ScriptScheduleQueryFilter.builder()
                .startAtFrom(from).build()).get("startAt");

        assertThat(startAt).containsKey("$gte");
        assertThat(startAt).doesNotContainKey("$lte");
    }

    @Test
    void startAtRange_openEnded_onlyUpperBound() {
        Instant to = Instant.parse("2026-05-01T00:00:00Z");

        Document startAt = (Document) countQueryFor(ScriptScheduleQueryFilter.builder()
                .startAtTo(to).build()).get("startAt");

        assertThat(startAt).containsKey("$lte");
        assertThat(startAt).doesNotContainKey("$gte");
    }

    @Test
    void noStartAtFilter_addsNoStartAtCriteria() {
        Document q = countQueryFor(ScriptScheduleQueryFilter.builder().build());

        assertThat(q).doesNotContainKey("startAt");
    }
}
