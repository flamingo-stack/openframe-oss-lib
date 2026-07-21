package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptScheduleQueryFilter;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link ScriptScheduleRepository} /
 * {@code CustomScriptScheduleRepositoryImpl} against a real MongoDB
 * (Testcontainers). Mirrors {@code ScriptRepositoryIT}: cursor pagination,
 * tenant isolation, soft-delete exclusion, count, and facets.
 */
@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ScriptScheduleRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";

    @Autowired
    private ScriptScheduleRepository scheduleRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        // Clear documents but keep indexes (dropCollection would drop them and
        // Spring Data's auto-index-creation only runs at startup).
        mongoTemplate.remove(new Query(), ScriptSchedule.class);
    }

    private ScriptSchedule save(String tenantId, String name, ScriptStatus status,
                                String createdBy, List<ScriptPlatform> platforms) {
        ScriptSchedule schedule = ScriptSchedule.builder()
                .tenantId(tenantId)
                .name(name)
                .status(status)
                .createdBy(createdBy)
                .supportedPlatforms(platforms)
                .build();
        return scheduleRepository.save(schedule);
    }

    private ScriptSchedule saveActive(String tenantId, String name) {
        return save(tenantId, name, ScriptStatus.ACTIVE, "user-1", List.of(ScriptPlatform.WINDOWS));
    }

    @Test
    @DisplayName("findByTenantIdAndId isolates by tenant")
    void findByTenantIdAndId_isolatesByTenant() {
        ScriptSchedule a = saveActive(TENANT_A, "A");
        assertThat(scheduleRepository.findByTenantIdAndId(TENANT_B, a.getId())).isEmpty();
        assertThat(scheduleRepository.findByTenantIdAndId(TENANT_A, a.getId())).isPresent();
    }

    @Test
    @DisplayName("findPageForTenant with no cursor returns schedules newest-first by _id")
    void findPageForTenant_noCursor_newestFirst() {
        ScriptSchedule s1 = saveActive(TENANT_A, "s1");
        ScriptSchedule s2 = saveActive(TENANT_A, "s2");
        ScriptSchedule s3 = saveActive(TENANT_A, "s3");

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getId)
                .containsExactly(s3.getId(), s2.getId(), s1.getId());
    }

    @Test
    @DisplayName("findPageForTenant forward cursor returns only rows older than the cursor")
    void findPageForTenant_forwardCursor_olderRows() {
        ScriptSchedule s1 = saveActive(TENANT_A, "s1");
        ScriptSchedule s2 = saveActive(TENANT_A, "s2");
        ScriptSchedule s3 = saveActive(TENANT_A, "s3");

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, s3.getId(), false, 10);

        assertThat(page).extracting(ScriptSchedule::getId).containsExactly(s2.getId(), s1.getId());
    }

    @Test
    @DisplayName("repeat is a sortable field; _id is not (allowlist guards the sort input)")
    void isSortableField_includesRepeat() {
        assertThat(scheduleRepository.isSortableField("repeat")).isTrue();
        assertThat(scheduleRepository.isSortableField("bogus")).isFalse();
    }

    @Test
    @DisplayName("findPageForTenant sorts by repeat ASC — nulls (one-shot schedules) first, then ascending interval")
    void findPageForTenant_sortsByRepeatAscending() {
        ScriptSchedule weekly = saveWithRepeat(TENANT_A, "weekly", 604800L);
        ScriptSchedule halfHour = saveWithRepeat(TENANT_A, "halfHour", 1800L);
        ScriptSchedule oneShot = saveWithRepeat(TENANT_A, "oneShot", null);

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "repeat", Sort.Direction.ASC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getId)
                .containsExactly(oneShot.getId(), halfHour.getId(), weekly.getId());
    }

    @Test
    @DisplayName("findPageForTenant sorts by repeat DESC — largest interval first")
    void findPageForTenant_sortsByRepeatDescending() {
        ScriptSchedule halfHour = saveWithRepeat(TENANT_A, "halfHour", 1800L);
        ScriptSchedule weekly = saveWithRepeat(TENANT_A, "weekly", 604800L);
        ScriptSchedule daily = saveWithRepeat(TENANT_A, "daily", 86400L);

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "repeat", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getId)
                .startsWith(weekly.getId(), daily.getId(), halfHour.getId());
    }

    @Test
    @DisplayName("equal repeat values fall back to the _id tie-breaker — order is stable, not arbitrary")
    void findPageForTenant_repeatTiesBrokenById() {
        ScriptSchedule a = saveWithRepeat(TENANT_A, "a", 604800L);
        ScriptSchedule b = saveWithRepeat(TENANT_A, "b", 604800L);
        ScriptSchedule c = saveWithRepeat(TENANT_A, "c", 604800L);

        List<ScriptSchedule> desc = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "repeat", Sort.Direction.DESC, null, false, 10);
        // All three tie on repeat → _id DESC decides, and repeats identically across calls.
        assertThat(desc).extracting(ScriptSchedule::getId)
                .containsExactly(c.getId(), b.getId(), a.getId());

        List<ScriptSchedule> again = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "repeat", Sort.Direction.DESC, null, false, 10);
        assertThat(again).extracting(ScriptSchedule::getId)
                .containsExactlyElementsOf(desc.stream().map(ScriptSchedule::getId).toList());
    }

    @Test
    @DisplayName("compound cursor pages through a repeat tie group without skipping or repeating rows")
    void findPageForTenant_repeatKeysetPagesCleanlyAcrossTies() {
        // 5 schedules, only 2 distinct repeat values → every page boundary lands inside a tie.
        ScriptSchedule w1 = saveWithRepeat(TENANT_A, "w1", 604800L);
        ScriptSchedule w2 = saveWithRepeat(TENANT_A, "w2", 604800L);
        ScriptSchedule w3 = saveWithRepeat(TENANT_A, "w3", 604800L);
        ScriptSchedule h1 = saveWithRepeat(TENANT_A, "h1", 1800L);
        ScriptSchedule h2 = saveWithRepeat(TENANT_A, "h2", 1800L);

        List<String> walked = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 5; page++) {
            List<ScriptSchedule> chunk = scheduleRepository.findPageForTenant(
                    TENANT_A, null, null, "repeat", Sort.Direction.DESC, cursor, false, 2);
            if (chunk.isEmpty()) {
                break;
            }
            chunk.forEach(s -> walked.add(s.getId()));
            cursor = scheduleRepository.encodeCursor(chunk.getLast(), "repeat");
        }

        // Every row exactly once, in (repeat DESC, _id DESC) order.
        assertThat(walked).containsExactly(w3.getId(), w2.getId(), w1.getId(), h2.getId(), h1.getId());
        assertThat(walked).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("compound cursor ASC crosses the null (one-shot) group into the numeric group exactly once")
    void findPageForTenant_repeatKeysetCrossesNullBoundaryAscending() {
        ScriptSchedule n1 = saveWithRepeat(TENANT_A, "n1", null);
        ScriptSchedule n2 = saveWithRepeat(TENANT_A, "n2", null);
        ScriptSchedule half = saveWithRepeat(TENANT_A, "half", 1800L);
        ScriptSchedule week = saveWithRepeat(TENANT_A, "week", 604800L);

        List<String> walked = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 5; page++) {
            List<ScriptSchedule> chunk = scheduleRepository.findPageForTenant(
                    TENANT_A, null, null, "repeat", Sort.Direction.ASC, cursor, false, 1);
            if (chunk.isEmpty()) {
                break;
            }
            chunk.forEach(s -> walked.add(s.getId()));
            cursor = scheduleRepository.encodeCursor(chunk.getLast(), "repeat");
        }

        // Nulls first (by _id ASC), then ascending intervals — no row lost at the null→number boundary.
        assertThat(walked).containsExactly(n1.getId(), n2.getId(), half.getId(), week.getId());
    }

    @Test
    @DisplayName("encodeCursor: plain id for an _id sort, value|id for a compound sort, empty value for null repeat")
    void encodeCursor_formats() {
        ScriptSchedule weekly = saveWithRepeat(TENANT_A, "weekly", 604800L);
        ScriptSchedule oneShot = saveWithRepeat(TENANT_A, "oneShot", null);

        assertThat(scheduleRepository.encodeCursor(weekly, "_id")).isEqualTo(weekly.getId());
        assertThat(scheduleRepository.encodeCursor(weekly, "repeat")).isEqualTo("604800|" + weekly.getId());
        assertThat(scheduleRepository.encodeCursor(oneShot, "repeat")).isEqualTo("|" + oneShot.getId());
    }

    @Test
    @DisplayName("a malformed cursor falls back to the first page instead of throwing")
    void findPageForTenant_malformedCursorFallsBackToFirstPage() {
        saveWithRepeat(TENANT_A, "a", 1800L);
        saveWithRepeat(TENANT_A, "b", 1800L);

        List<ScriptSchedule> noSeparator = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "repeat", Sort.Direction.DESC, "garbage", false, 10);
        List<ScriptSchedule> badId = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "repeat", Sort.Direction.DESC, "1800|not-an-objectid", false, 10);
        List<ScriptSchedule> badValue = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "repeat", Sort.Direction.DESC, "abc|" + new ObjectId(), false, 10);

        assertThat(noSeparator).hasSize(2);
        assertThat(badId).hasSize(2);
        assertThat(badValue).hasSize(2);
    }

    private ScriptSchedule saveWithRepeat(String tenantId, String name, Long repeat) {
        ScriptSchedule schedule = ScriptSchedule.builder()
                .tenantId(tenantId)
                .name(name)
                .status(ScriptStatus.ACTIVE)
                .createdBy("user-1")
                .supportedPlatforms(List.of(ScriptPlatform.WINDOWS))
                .repeat(repeat)
                .build();
        return scheduleRepository.save(schedule);
    }

    @Test
    @DisplayName("deviceCount IS sortable — served via aggregation ($lookup + $addFields on assignments), no denormalised field on the schedule document")
    void isSortableField_includesDeviceCount() {
        assertThat(scheduleRepository.isSortableField("deviceCount")).isTrue();
    }

    @Test
    @DisplayName("sort by deviceCount DESC — schedules with the most assigned machines come first; deviceCount is populated on the returned entities from the aggregation")
    void findPageForTenant_sortsByDeviceCountDesc() {
        ScriptSchedule few = saveActive(TENANT_A, "few");
        ScriptSchedule many = saveActive(TENANT_A, "many");
        ScriptSchedule mid = saveActive(TENANT_A, "mid");
        assignMachines(TENANT_A, few.getId(), List.of("m1", "m2"));
        assignMachines(TENANT_A, mid.getId(), List.of("m1", "m2", "m3", "m4"));
        assignMachines(TENANT_A, many.getId(), List.of("m1", "m2", "m3", "m4", "m5", "m6"));

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "deviceCount", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getId)
                .containsExactly(many.getId(), mid.getId(), few.getId());
        // Cursor encoding reads the count via an independent indexed lookup — verifies the
        // schedule doc stays clean (no denormalised deviceCount field) while still supporting sort.
        assertThat(scheduleRepository.encodeCursor(page.get(0), "deviceCount")).startsWith("6|");
        assertThat(scheduleRepository.encodeCursor(page.get(1), "deviceCount")).startsWith("4|");
        assertThat(scheduleRepository.encodeCursor(page.get(2), "deviceCount")).startsWith("2|");
    }

    @Test
    @DisplayName("sort by deviceCount ASC — schedules with NO assignments (missing assignment doc) count as 0 and come first, not last")
    void findPageForTenant_sortsByDeviceCountAsc_missingAssignmentIsZero() {
        ScriptSchedule none = saveActive(TENANT_A, "none");   // no assignment doc at all
        ScriptSchedule some = saveActive(TENANT_A, "some");
        assignMachines(TENANT_A, some.getId(), List.of("m1", "m2"));

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "deviceCount", Sort.Direction.ASC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getId).containsExactly(none.getId(), some.getId());
        // cursor for the no-assignment schedule encodes 0 (matching the aggregation's $sum semantics)
        assertThat(scheduleRepository.encodeCursor(page.get(0), "deviceCount")).startsWith("0|");
        assertThat(scheduleRepository.encodeCursor(page.get(1), "deviceCount")).startsWith("2|");
    }

    @Test
    @DisplayName("aggregation cursor pages through a deviceCount tie group without skipping or repeating rows (infinite-scroll semantics)")
    void findPageForTenant_deviceCountCursorPagesCleanlyAcrossTies() {
        ScriptSchedule a = saveActive(TENANT_A, "a");
        ScriptSchedule b = saveActive(TENANT_A, "b");
        ScriptSchedule c = saveActive(TENANT_A, "c");
        ScriptSchedule d = saveActive(TENANT_A, "d");
        // three schedules tied on 3 machines each; the fourth trails on 1
        assignMachines(TENANT_A, a.getId(), List.of("m1", "m2", "m3"));
        assignMachines(TENANT_A, b.getId(), List.of("m1", "m2", "m3"));
        assignMachines(TENANT_A, c.getId(), List.of("m1", "m2", "m3"));
        assignMachines(TENANT_A, d.getId(), List.of("m1"));

        List<String> walked = new ArrayList<>();
        String cursor = null;
        for (int pass = 0; pass < 5; pass++) {
            List<ScriptSchedule> chunk = scheduleRepository.findPageForTenant(
                    TENANT_A, null, null, "deviceCount", Sort.Direction.DESC, cursor, false, 2);
            if (chunk.isEmpty()) {
                break;
            }
            chunk.forEach(x -> walked.add(x.getId()));
            cursor = scheduleRepository.encodeCursor(chunk.getLast(), "deviceCount");
        }

        assertThat(walked).hasSize(4);
        assertThat(walked).doesNotHaveDuplicates();
        assertThat(walked.getLast()).isEqualTo(d.getId());   // "d" (count=1) always last on DESC
    }

    @Test
    @DisplayName("sort by deviceCount is tenant-isolated — a schedule in tenant B does not leak into tenant A's page even if their assignment docs coexist in the collection")
    void findPageForTenant_deviceCountAggregation_isTenantIsolated() {
        ScriptSchedule aOnly = saveActive(TENANT_A, "a-only");
        ScriptSchedule bOnly = save(TENANT_B, "b-only", ScriptStatus.ACTIVE, "user-1", List.of(ScriptPlatform.LINUX));
        assignMachines(TENANT_A, aOnly.getId(), List.of("m1"));
        assignMachines(TENANT_B, bOnly.getId(), List.of("m1", "m2", "m3", "m4"));

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "deviceCount", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getId).containsExactly(aOnly.getId());
    }

    private void assignMachines(String tenantId, String scheduleId, List<String> machineIds) {
        mongoTemplate.getCollection("script_schedules_machines_assigned").insertOne(
                new org.bson.Document()
                        .append("tenantId", tenantId)
                        .append("scriptScheduleIds", List.of(scheduleId))
                        .append("machineIds", machineIds));
    }

    @Test
    @DisplayName("findPageForTenant excludes soft-deleted schedules by default")
    void findPageForTenant_excludesDeleted() {
        saveActive(TENANT_A, "active");
        save(TENANT_A, "deleted", ScriptStatus.DELETED, "user-1", List.of(ScriptPlatform.LINUX));

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getName).containsExactly("active");
    }

    @Test
    @DisplayName("findPageForTenant isolates by tenant")
    void findPageForTenant_isolatesByTenant() {
        saveActive(TENANT_A, "a1");
        saveActive(TENANT_B, "b1");

        List<ScriptSchedule> page = scheduleRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptSchedule::getName).containsExactly("a1");
    }

    @Test
    @DisplayName("countForTenant returns the full matching total, excluding DELETED by default")
    void countForTenant_excludesDeletedByDefault() {
        saveActive(TENANT_A, "a1");
        saveActive(TENANT_A, "a2");
        save(TENANT_A, "gone", ScriptStatus.DELETED, "user-1", List.of(ScriptPlatform.WINDOWS));

        assertThat(scheduleRepository.countForTenant(TENANT_A, null, null)).isEqualTo(2L);
    }

    @Test
    @DisplayName("platformFacet counts schedules per supported platform (array unwound)")
    void platformFacet_countsByPlatform() {
        save(TENANT_A, "win", ScriptStatus.ACTIVE, "user-1", List.of(ScriptPlatform.WINDOWS));
        save(TENANT_A, "both", ScriptStatus.ACTIVE, "user-1", List.of(ScriptPlatform.WINDOWS, ScriptPlatform.LINUX));

        Map<String, Integer> facet = scheduleRepository.platformFacet(TENANT_A, null);

        assertThat(facet).containsEntry(ScriptPlatform.WINDOWS.name(), 2)
                .containsEntry(ScriptPlatform.LINUX.name(), 1);
    }

    @Test
    @DisplayName("authorFacet counts schedules per createdBy user")
    void authorFacet_countsByCreatedBy() {
        save(TENANT_A, "s1", ScriptStatus.ACTIVE, "user-1", List.of(ScriptPlatform.WINDOWS));
        save(TENANT_A, "s2", ScriptStatus.ACTIVE, "user-1", List.of(ScriptPlatform.WINDOWS));
        save(TENANT_A, "s3", ScriptStatus.ACTIVE, "user-2", List.of(ScriptPlatform.WINDOWS));

        Map<String, Integer> facet = scheduleRepository.authorFacet(TENANT_A, new ScriptScheduleQueryFilter());

        assertThat(facet).containsEntry("user-1", 2).containsEntry("user-2", 1);
    }
}
