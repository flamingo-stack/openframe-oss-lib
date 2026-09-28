package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Sorting the "Schedule Runs" tab by {@code dispatchedAt} (date/time), tie-broken by {@code _id},
 * with a compound {@code (dispatchedAt, _id)} keyset cursor. {@code _id} stays the default.
 */
class CustomScheduleScriptExecutionRepositoryImplSortTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScheduleScriptExecutionRepositoryImpl repo =
            new CustomScheduleScriptExecutionRepositoryImpl(mongoTemplate);

    private Query capture(String sortField, Sort.Direction dir, String cursor, boolean backward) {
        when(mongoTemplate.find(any(Query.class), eq(ScheduleScriptExecution.class))).thenReturn(List.of());
        repo.findPageForSchedule("t1", "sched-1", null, null, sortField, dir, cursor, backward, 20);
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).find(captor.capture(), eq(ScheduleScriptExecution.class));
        return captor.getValue();
    }

    @Test
    void dispatchedAtSortDesc_sortsByDispatchedAtThenId() {
        Document sort = capture("dispatchedAt", Sort.Direction.DESC, null, false).getSortObject();
        assertThat(new ArrayList<>(sort.keySet())).containsExactly("dispatchedAt", "_id");
        assertThat(sort.get("dispatchedAt")).isEqualTo(-1);
        assertThat(sort.get("_id")).isEqualTo(-1);
    }

    @Test
    void backwardPaging_flipsDirection() {
        Document sort = capture("dispatchedAt", Sort.Direction.DESC, null, true).getSortObject();
        assertThat(sort.get("dispatchedAt")).isEqualTo(1);   // flip of DESC under backward
        assertThat(sort.get("_id")).isEqualTo(1);
    }

    @Test
    void dispatchedAtCursor_appliesCompoundKeyset() {
        // Structural check (not toJson): the criteria carries a raw Instant that the default BSON
        // codec can't render — Spring's converter handles that at query time.
        Document q = capture("dispatchedAt", Sort.Direction.DESC,
                "1735689600000|507f1f77bcf86cd799439011", false).getQueryObject();
        assertThat(mentions(q, "$or")).isTrue();
        assertThat(mentions(q, "dispatchedAt")).isTrue();
    }

    /** Deep-walk the ($and/$or-nested) query Document for a key. */
    private static boolean mentions(Object node, String key) {
        if (node instanceof Document d) {
            return d.containsKey(key) || d.values().stream().anyMatch(v -> mentions(v, key));
        }
        if (node instanceof List<?> l) {
            return l.stream().anyMatch(v -> mentions(v, key));
        }
        return false;
    }

    @Test
    void idSortDefault_sortsByIdOnly() {
        Document sort = capture("_id", Sort.Direction.DESC, null, false).getSortObject();
        assertThat(new ArrayList<>(sort.keySet())).containsExactly("_id");
    }

    @Test
    void encodeCursor_dispatchedAt_isMillisId() {
        Instant at = Instant.parse("2026-01-01T00:00:00Z");
        ScheduleScriptExecution run = ScheduleScriptExecution.builder()
                .id("507f1f77bcf86cd799439011").dispatchedAt(at).build();
        assertThat(repo.encodeCursor(run, "dispatchedAt"))
                .isEqualTo(at.toEpochMilli() + "|507f1f77bcf86cd799439011");
    }

    @Test
    void encodeCursor_id_isRawId() {
        assertThat(repo.encodeCursor(ScheduleScriptExecution.builder().id("abc").build(), "_id")).isEqualTo("abc");
    }

    @Test
    void sortableFields() {
        assertThat(repo.isSortableField("dispatchedAt")).isTrue();
        assertThat(repo.isSortableField("bogus")).isFalse();
        assertThat(repo.getDefaultSortField()).isEqualTo("_id");
    }
}
