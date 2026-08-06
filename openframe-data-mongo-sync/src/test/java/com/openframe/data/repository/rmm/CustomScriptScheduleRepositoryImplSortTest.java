package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomScriptScheduleRepositoryImplSortTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptScheduleRepositoryImpl repo = new CustomScriptScheduleRepositoryImpl(mongoTemplate);

    private List<Document> pipelineForDateSort(String sortField, Sort.Direction dir, String cursor) {
        return pipelineForDateSort(sortField, dir, cursor, false);
    }

    private List<Document> pipelineForDateSort(String sortField, Sort.Direction dir, String cursor, boolean backward) {
        when(mongoTemplate.aggregate(any(Aggregation.class), eq("script_schedules"), eq(Document.class)))
                .thenReturn(new AggregationResults<>(List.of(), new Document()));

        repo.findPageForTenant("t1", null, null, sortField, dir, cursor, backward, 20);

        ArgumentCaptor<Aggregation> captor = ArgumentCaptor.forClass(Aggregation.class);
        verify(mongoTemplate).aggregate(captor.capture(), eq("script_schedules"), eq(Document.class));
        return captor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
    }

    private static Document stage(List<Document> pipeline, String key) {
        return pipeline.stream().filter(d -> d.containsKey(key)).findFirst().orElseThrow();
    }

    @Test
    void createdAtSort_primaryKeyIsTriggerBucketAsc_deviceOnlineLast() {
        List<Document> pipeline = pipelineForDateSort("createdAt", Sort.Direction.DESC, null);

        // $addFields _triggerBucket = (trigger == DEVICE_ONLINE ? 1 : 0)
        Document addFields = (Document) stage(pipeline, "$addFields").get("$addFields");
        assertThat(addFields).containsKey("_triggerBucket");
        assertThat(addFields.toJson()).contains("DEVICE_ONLINE");

        // $sort: bucket ASC first (so DEVICE_ONLINE trails), then createdAt DESC, then _id DESC
        Document sort = (Document) stage(pipeline, "$sort").get("$sort");
        assertThat(new ArrayList<>(sort.keySet())).containsExactly("_triggerBucket", "createdAt", "_id");
        assertThat(sort.get("_triggerBucket")).isEqualTo(1);
        assertThat(sort.get("createdAt")).isEqualTo(-1);
        assertThat(sort.get("_id")).isEqualTo(-1);
    }

    @Test
    void backwardPaging_flipsEveryKeyIncludingBucket_soReversalKeepsDeviceOnlineLast() {
        // Backward paging reverses the whole sort (the service re-reverses the page). The bucket must
        // flip too — otherwise DEVICE_ONLINE would surface first on backward pages.
        Document sort = (Document) stage(
                pipelineForDateSort("createdAt", Sort.Direction.DESC, null, true), "$sort").get("$sort");
        assertThat(sort.get("_triggerBucket")).isEqualTo(-1);   // flipped to DESC under backward
        assertThat(sort.get("createdAt")).isEqualTo(1);          // flip of requested DESC
        assertThat(sort.get("_id")).isEqualTo(1);
    }

    @Test
    void backwardCursor_bucketKeysetComparatorFlipsToLt() {
        List<Document> pipeline = pipelineForDateSort("createdAt", Sort.Direction.DESC,
                "1|1735689600000|507f1f77bcf86cd799439011", true);
        Document match = pipeline.stream()
                .filter(d -> d.containsKey("$match") && d.get("$match") instanceof Document m && m.containsKey("$or"))
                .findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        List<Document> or = (List<Document>) ((Document) match.get("$match")).get("$or");
        Document bucketArm = (Document) or.get(0).get("_triggerBucket");
        assertThat(bucketArm).containsKey("$lt");   // bucket walks DESC under backward
    }

    @Test
    void startAtSort_deviceOnlineLast_bucketThenStartAtThenId() {
        Document sort = (Document) stage(pipelineForDateSort("startAt", Sort.Direction.ASC, null), "$sort").get("$sort");
        assertThat(new ArrayList<>(sort.keySet())).containsExactly("_triggerBucket", "startAt", "_id");
        assertThat(sort.get("_triggerBucket")).isEqualTo(1);   // DEVICE_ONLINE always last
        assertThat(sort.get("startAt")).isEqualTo(1);
    }

    @Test
    void encodeCursor_startAtSort_dateTime_usesStartAtMillis_bucketZero() {
        Instant startAt = Instant.parse("2026-03-15T00:00:00Z");
        ScriptSchedule s = new ScriptSchedule();
        s.setId("507f1f77bcf86cd799439011");
        s.setStartAt(startAt);
        s.setTrigger(ScriptScheduleTrigger.DATE_TIME);

        assertThat(repo.encodeCursor(s, "startAt"))
                .isEqualTo("0|" + startAt.toEpochMilli() + "|507f1f77bcf86cd799439011");
    }

    @Test
    void encodeCursor_startAtSort_deviceOnline_nullStartAt_isEmptyMillisBucketOne() {
        // DEVICE_ONLINE always has null startAt (invariant); the millis segment must be empty,
        // not a 0 sentinel, so the keyset can match on null instead of Date(0).
        ScriptSchedule s = new ScriptSchedule();
        s.setId("507f1f77bcf86cd799439011");
        s.setTrigger(ScriptScheduleTrigger.DEVICE_ONLINE);   // startAt left null

        assertThat(repo.encodeCursor(s, "startAt")).isEqualTo("1||507f1f77bcf86cd799439011");
    }

    @Test
    void startAtCursor_nullDatedBucket_keysetMatchesNullNotSentinel_soDeviceOnlineTailPaginates() {
        // Regression: a cursor sitting inside the DEVICE_ONLINE tail (null startAt) must continue
        // by _id within bucket 1. Matching startAt == Date(0) would hit nothing and drop the rest.
        List<Document> pipeline = pipelineForDateSort("startAt", Sort.Direction.ASC,
                "1||507f1f77bcf86cd799439011");
        Document match = pipeline.stream()
                .filter(d -> d.containsKey("$match") && d.get("$match") instanceof Document m && m.containsKey("$or"))
                .findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        List<Document> or = (List<Document>) ((Document) match.get("$match")).get("$or");
        Document tieArm = or.get(1);
        assertThat(tieArm.get("_triggerBucket")).isEqualTo(1);
        assertThat(tieArm.containsKey("startAt")).isTrue();
        assertThat(tieArm.get("startAt")).isNull();                 // matches null, not Date(0)
        assertThat((Document) tieArm.get("_id")).containsKey("$gt");
    }

    @Test
    void updatedAtSort_ascending_bucketStillAscending() {
        Document sort = (Document) stage(pipelineForDateSort("updatedAt", Sort.Direction.ASC, null), "$sort").get("$sort");
        assertThat(sort.get("_triggerBucket")).isEqualTo(1);   // bucket never flips — DEVICE_ONLINE always last
        assertThat(sort.get("updatedAt")).isEqualTo(1);
    }

    @Test
    void dateCursor_appliesBucketKeyset() {
        List<Document> pipeline = pipelineForDateSort("createdAt", Sort.Direction.DESC,
                "0|1735689600000|507f1f77bcf86cd799439011");

        // A $match with an $or keyset over the trigger bucket is inserted before the $sort.
        Document match = pipeline.stream()
                .filter(d -> d.containsKey("$match") && d.get("$match") instanceof Document m && m.containsKey("$or"))
                .findFirst().orElseThrow();
        assertThat(match.toJson()).contains("_triggerBucket");
    }

    @Test
    void encodeCursor_dateSort_isBucketMillisId_deviceOnlineBucketOne() {
        Instant created = Instant.parse("2026-01-01T00:00:00Z");
        ScriptSchedule s = new ScriptSchedule();
        s.setId("507f1f77bcf86cd799439011");
        s.setCreatedAt(created);
        s.setTrigger(ScriptScheduleTrigger.DEVICE_ONLINE);

        assertThat(repo.encodeCursor(s, "createdAt"))
                .isEqualTo("1|" + created.toEpochMilli() + "|507f1f77bcf86cd799439011");
    }

    @Test
    void encodeCursor_dateSort_dateTimeIsBucketZero() {
        ScriptSchedule s = new ScriptSchedule();
        s.setId("id-1");
        s.setUpdatedAt(Instant.parse("2026-02-01T00:00:00Z"));
        s.setTrigger(ScriptScheduleTrigger.DATE_TIME);

        assertThat(repo.encodeCursor(s, "updatedAt")).startsWith("0|");
    }
}
