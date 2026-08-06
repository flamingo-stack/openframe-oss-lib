package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
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

    private List<Document> startAtPipeline(Sort.Direction dir, String cursor) {
        return startAtPipeline(dir, cursor, false, null);
    }

    private List<Document> startAtPipeline(Sort.Direction dir, String cursor, boolean backward) {
        return startAtPipeline(dir, cursor, backward, null);
    }

    private List<Document> startAtPipeline(Sort.Direction dir, String cursor, boolean backward,
                                           ScriptScheduleQueryFilter filter) {
        when(mongoTemplate.aggregate(any(Aggregation.class), eq("script_schedules"), eq(Document.class)))
                .thenReturn(new AggregationResults<>(List.of(), new Document()));

        repo.findPageForTenant("t1", filter, null, "startAt", dir, cursor, backward, 20);

        ArgumentCaptor<Aggregation> captor = ArgumentCaptor.forClass(Aggregation.class);
        verify(mongoTemplate).aggregate(captor.capture(), eq("script_schedules"), eq(Document.class));
        return captor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT);
    }

    private static boolean hasKeysetStage(List<Document> pipeline) {
        return pipeline.stream().anyMatch(d ->
                d.containsKey("$match") && d.get("$match") instanceof Document m && m.containsKey("$or"));
    }

    private static Document stage(List<Document> pipeline, String key) {
        return pipeline.stream().filter(d -> d.containsKey(key)).findFirst().orElseThrow();
    }

    private static List<Document> keysetArms(List<Document> pipeline) {
        Document match = pipeline.stream()
                .filter(d -> d.containsKey("$match") && d.get("$match") instanceof Document m && m.containsKey("$or"))
                .findFirst().orElseThrow();
        @SuppressWarnings("unchecked")
        List<Document> or = (List<Document>) ((Document) match.get("$match")).get("$or");
        return or;
    }

    @Test
    void startAtSort_descending_bucketAscThenStartAtDescThenIdDesc_deviceOnlineLast() {
        List<Document> pipeline = startAtPipeline(Sort.Direction.DESC, null);

        // $addFields _triggerBucket = (trigger == DEVICE_ONLINE ? 1 : 0)
        Document addFields = (Document) stage(pipeline, "$addFields").get("$addFields");
        assertThat(addFields).containsKey("_triggerBucket");
        assertThat(addFields.toJson()).contains("DEVICE_ONLINE");

        // $sort: bucket ASC first (so DEVICE_ONLINE trails), then startAt DESC, then _id DESC
        Document sort = (Document) stage(pipeline, "$sort").get("$sort");
        assertThat(new ArrayList<>(sort.keySet())).containsExactly("_triggerBucket", "startAt", "_id");
        assertThat(sort.get("_triggerBucket")).isEqualTo(1);
        assertThat(sort.get("startAt")).isEqualTo(-1);
        assertThat(sort.get("_id")).isEqualTo(-1);
    }

    @Test
    void startAtSort_ascending_bucketStillAscending_deviceOnlineLast() {
        Document sort = (Document) stage(startAtPipeline(Sort.Direction.ASC, null), "$sort").get("$sort");
        assertThat(sort.get("_triggerBucket")).isEqualTo(1);   // bucket never flips — DEVICE_ONLINE always last
        assertThat(sort.get("startAt")).isEqualTo(1);
    }

    @Test
    void backwardPaging_flipsEveryKeyIncludingBucket_soReversalKeepsDeviceOnlineLast() {
        // Backward paging reverses the whole sort (the service re-reverses the page). The bucket must
        // flip too — otherwise DEVICE_ONLINE would surface first on backward pages.
        Document sort = (Document) stage(startAtPipeline(Sort.Direction.DESC, null, true), "$sort").get("$sort");
        assertThat(sort.get("_triggerBucket")).isEqualTo(-1);   // flipped to DESC under backward
        assertThat(sort.get("startAt")).isEqualTo(1);            // flip of requested DESC
        assertThat(sort.get("_id")).isEqualTo(1);
    }

    @Test
    void backwardCursor_bucketKeysetComparatorFlipsToLt() {
        List<Document> or = keysetArms(startAtPipeline(Sort.Direction.DESC,
                "0|1735689600000|507f1f77bcf86cd799439011", true));
        Document bucketArm = (Document) or.get(0).get("_triggerBucket");
        assertThat(bucketArm).containsKey("$lt");   // bucket walks DESC under backward
    }

    @Test
    void startAtCursor_appliesBucketKeyset() {
        Document match = startAtPipeline(Sort.Direction.DESC, "0|1735689600000|507f1f77bcf86cd799439011").stream()
                .filter(d -> d.containsKey("$match") && d.get("$match") instanceof Document m && m.containsKey("$or"))
                .findFirst().orElseThrow();
        assertThat(match.toJson()).contains("_triggerBucket");
    }

    @Test
    void startAtCursor_nullDatedBucket_keysetMatchesNullNotSentinel_soDeviceOnlineTailPaginates() {
        List<Document> or = keysetArms(startAtPipeline(Sort.Direction.ASC, "1||507f1f77bcf86cd799439011"));
        Document tieArm = or.get(1);
        assertThat(tieArm.get("_triggerBucket")).isEqualTo(1);
        assertThat(tieArm.containsKey("startAt")).isTrue();
        assertThat(tieArm.get("startAt")).isNull();                 // matches null, not Date(0)
        assertThat((Document) tieArm.get("_id")).containsKey("$gt");
    }

    @Test
    void encodeCursor_dateTime_usesStartAtMillis_bucketZero() {
        Instant startAt = Instant.parse("2026-03-15T00:00:00Z");
        ScriptSchedule s = new ScriptSchedule();
        s.setId("507f1f77bcf86cd799439011");
        s.setStartAt(startAt);
        s.setTrigger(ScriptScheduleTrigger.DATE_TIME);

        assertThat(repo.encodeCursor(s, "startAt"))
                .isEqualTo("0|" + startAt.toEpochMilli() + "|507f1f77bcf86cd799439011");
    }

    @Test
    void encodeCursor_deviceOnline_nullStartAt_isEmptyMillisBucketOne() {
        // DEVICE_ONLINE always has null startAt (invariant); the millis segment must be empty,
        // not a 0 sentinel, so the keyset can match on null instead of Date(0).
        ScriptSchedule s = new ScriptSchedule();
        s.setId("507f1f77bcf86cd799439011");
        s.setTrigger(ScriptScheduleTrigger.DEVICE_ONLINE);   // startAt left null

        assertThat(repo.encodeCursor(s, "startAt")).isEqualTo("1||507f1f77bcf86cd799439011");
    }

    @Test
    void forwardCursor_dateTimeBucket_ascending_isGtThreeArmKeyset() {
        List<Document> or = keysetArms(startAtPipeline(Sort.Direction.ASC, "0|1735689600000|507f1f77bcf86cd799439011"));
        assertThat(or).hasSize(3);
        // arm0: next bucket (bucket > 0)
        assertThat((Document) or.get(0).get("_triggerBucket")).containsEntry("$gt", 0);
        // arm1: same bucket, later startAt (startAt > cursor date)
        assertThat(or.get(1).get("_triggerBucket")).isEqualTo(0);
        assertThat((Document) or.get(1).get("startAt")).containsKey("$gt");
        // arm2: same bucket, same startAt, later _id
        assertThat(or.get(2).get("_triggerBucket")).isEqualTo(0);
        assertThat(or.get(2).get("startAt")).isInstanceOf(Date.class);
        assertThat((Document) or.get(2).get("_id")).containsKey("$gt");
    }

    @Test
    void forwardCursor_dateTimeBucket_descending_flipsKeysetToLt() {
        List<Document> or = keysetArms(startAtPipeline(Sort.Direction.DESC, "0|1735689600000|507f1f77bcf86cd799439011"));
        assertThat((Document) or.get(1).get("startAt")).containsKey("$lt");
        assertThat((Document) or.get(2).get("_id")).containsKey("$lt");
    }

    @Test
    void invalidCursor_wrongPartCount_fallsBackToFirstPage_noKeyset() {
        assertThat(hasKeysetStage(startAtPipeline(Sort.Direction.ASC, "not-a-valid-cursor"))).isFalse();
    }

    @Test
    void invalidCursor_badObjectId_fallsBackToFirstPage_noKeyset() {
        assertThat(hasKeysetStage(startAtPipeline(Sort.Direction.ASC, "0|1735689600000|not-an-objectid"))).isFalse();
    }

    @Test
    void invalidCursor_unparseableMillis_fallsBackToFirstPage_noKeyset() {
        assertThat(hasKeysetStage(startAtPipeline(Sort.Direction.ASC, "0|abc|507f1f77bcf86cd799439011"))).isFalse();
    }

    @Test
    void keysetMatchIsInsertedBeforeSort() {
        List<Document> pipeline = startAtPipeline(Sort.Direction.ASC, "0|1735689600000|507f1f77bcf86cd799439011");
        int keysetIdx = -1;
        int sortIdx = -1;
        for (int i = 0; i < pipeline.size(); i++) {
            Document d = pipeline.get(i);
            if (keysetIdx < 0 && d.containsKey("$match") && d.get("$match") instanceof Document m && m.containsKey("$or")) {
                keysetIdx = i;
            }
            if (sortIdx < 0 && d.containsKey("$sort")) {
                sortIdx = i;
            }
        }
        assertThat(keysetIdx).isGreaterThanOrEqualTo(0);
        assertThat(keysetIdx).isLessThan(sortIdx);
    }

    @Test
    void firstPage_noCursor_hasNoKeysetStage() {
        assertThat(hasKeysetStage(startAtPipeline(Sort.Direction.ASC, null))).isFalse();
    }

    @Test
    void startAtFilter_isAppliedInAggregateBaseMatch_whenSortingByStartAt() {
        Instant from = Instant.parse("2026-04-01T00:00:00Z");
        List<Document> pipeline = startAtPipeline(Sort.Direction.ASC, null, false,
                ScriptScheduleQueryFilter.builder().startAtFrom(from).build());

        // The first $match is the base tenant+filter predicate (the keyset $or is a later stage).
        Document baseMatch = (Document) stage(pipeline, "$match").get("$match");
        assertThat(baseMatch).containsKey("startAt");
        assertThat((Document) baseMatch.get("startAt")).containsKey("$gte");
    }

    @Test
    void isSortableField_startAtTrue_createdAtAndUpdatedAtRemoved() {
        assertThat(repo.isSortableField("startAt")).isTrue();
        assertThat(repo.isSortableField("createdAt")).isFalse();
        assertThat(repo.isSortableField("updatedAt")).isFalse();
        assertThat(repo.isSortableField("bogus")).isFalse();
        assertThat(repo.isSortableField(null)).isFalse();
    }
}
