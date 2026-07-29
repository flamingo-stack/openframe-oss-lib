package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.filter.ScheduleRunQueryFilter;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration coverage for {@code CustomScheduleScriptExecutionRepositoryImpl.facet} — the "Schedule
 * Runs" filter facets. Mirrors {@code ScriptExecutionRepositoryIT}: a real Mongo (Testcontainers)
 * exercises the aggregation / own-field-exclusion assembly that a mocked {@code MongoTemplate}
 * cannot. {@code status} = "status" and {@code initiatedBy} = "initiatedBy" are the two facet fields.
 */
@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ScheduleScriptExecutionRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";
    private static final String SCHEDULE_1 = "schedule-1";
    private static final String SCHEDULE_2 = "schedule-2";
    private static final String FIELD_STATUS = "status";
    private static final String FIELD_INITIATED_BY = "initiatedBy";

    @Autowired
    private ScheduleScriptExecutionRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        mongoTemplate.remove(new Query(), ScheduleScriptExecution.class);
    }

    @Test
    @DisplayName("statusFacet: counts fires per status, ignores its own (statuses) filter so the dropdown keeps every status, scoped to (tenant, schedule)")
    void statusFacet_countsPerStatus_ownFieldExcluded_scoped() {
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "bob");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.FAILED, "alice");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.RUNNING, "alice");
        save(TENANT_A, SCHEDULE_2, ExecutionStatus.SUCCESS, "alice");   // other schedule — excluded
        save(TENANT_B, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice");   // other tenant — excluded

        // Even with statuses=[SUCCESS] active, the status facet shows ALL statuses (own field excluded).
        var facet = repository.facet(TENANT_A, SCHEDULE_1, filter(ExecutionStatus.SUCCESS), null, FIELD_STATUS);

        assertThat(facet).containsEntry("SUCCESS", 2).containsEntry("FAILED", 1).containsEntry("RUNNING", 1).hasSize(3);
    }

    @Test
    @DisplayName("initiatorFacet: counts fires per initiatedBy, drops null initiators, scoped to (tenant, schedule)")
    void initiatorFacet_countsPerInitiator_dropsNull_scoped() {
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.FAILED, "alice");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "bob");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.RUNNING, null);      // no initiator → dropped
        save(TENANT_B, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice");   // other tenant — excluded

        var facet = repository.facet(TENANT_A, SCHEDULE_1, null, null, FIELD_INITIATED_BY);

        assertThat(facet).containsEntry("alice", 2).containsEntry("bob", 1).hasSize(2);
    }

    @Test
    @DisplayName("initiatorFacet: a NON-own status filter still applies — only fires whose status is in the set are counted per initiator")
    void initiatorFacet_nonOwnStatusFilterApplies() {
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.RUNNING, "alice");   // excluded by status filter
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "bob");

        var facet = repository.facet(TENANT_A, SCHEDULE_1, filter(ExecutionStatus.SUCCESS), null, FIELD_INITIATED_BY);

        assertThat(facet).containsEntry("alice", 1).containsEntry("bob", 1).hasSize(2);
    }

    @Test
    @DisplayName("facet: the dispatchedAt range is never dropped — it narrows even the status facet")
    void facet_dispatchedAtRangeApplies() {
        Instant base = Instant.parse("2026-01-01T00:00:00Z");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice", base);
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.FAILED, "alice", base.plus(2, ChronoUnit.DAYS));

        ScheduleRunQueryFilter range = ScheduleRunQueryFilter.builder()
                .dispatchedAtFrom(base.minus(1, ChronoUnit.HOURS))
                .dispatchedAtTo(base.plus(1, ChronoUnit.HOURS))
                .build();

        var facet = repository.facet(TENANT_A, SCHEDULE_1, range, null, FIELD_STATUS);

        assertThat(facet).containsEntry("SUCCESS", 1).hasSize(1);   // the FAILED fire is out of range
    }

    @Test
    @DisplayName("facet: search narrows the facet by executionId (case-insensitive substring)")
    void facet_searchNarrowsByExecutionId() {
        saveWithExecutionId(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice", "run-DISK-1");
        saveWithExecutionId(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "bob", "run-cpu-2");

        var facet = repository.facet(TENANT_A, SCHEDULE_1, null, "disk", FIELD_INITIATED_BY);

        assertThat(facet).containsEntry("alice", 1).hasSize(1);
    }

    @Test
    @DisplayName("countForSchedule: scoped to (tenant, schedule) and narrowed by status filter")
    void countForSchedule_scopedAndFiltered() {
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice");
        save(TENANT_A, SCHEDULE_1, ExecutionStatus.RUNNING, "alice");
        save(TENANT_A, SCHEDULE_2, ExecutionStatus.SUCCESS, "alice");   // other schedule
        save(TENANT_B, SCHEDULE_1, ExecutionStatus.SUCCESS, "alice");   // other tenant

        assertThat(repository.countForSchedule(TENANT_A, SCHEDULE_1, null, null)).isEqualTo(2);
        assertThat(repository.countForSchedule(TENANT_A, SCHEDULE_1, filter(ExecutionStatus.SUCCESS), null)).isEqualTo(1);
    }

    private static ScheduleRunQueryFilter filter(ExecutionStatus... statuses) {
        return ScheduleRunQueryFilter.builder().statuses(List.of(statuses)).build();
    }

    private ScheduleScriptExecution save(String tenantId, String scheduleId, ExecutionStatus status, String initiatedBy) {
        return save(tenantId, scheduleId, status, initiatedBy, Instant.now());
    }

    private ScheduleScriptExecution save(String tenantId, String scheduleId, ExecutionStatus status,
                                         String initiatedBy, Instant dispatchedAt) {
        return saveWithExecutionId(tenantId, scheduleId, status, initiatedBy, "run-" + System.nanoTime(), dispatchedAt);
    }

    private ScheduleScriptExecution saveWithExecutionId(String tenantId, String scheduleId, ExecutionStatus status,
                                                        String initiatedBy, String executionId) {
        return saveWithExecutionId(tenantId, scheduleId, status, initiatedBy, executionId, Instant.now());
    }

    private ScheduleScriptExecution saveWithExecutionId(String tenantId, String scheduleId, ExecutionStatus status,
                                                        String initiatedBy, String executionId, Instant dispatchedAt) {
        return repository.save(ScheduleScriptExecution.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .scheduleId(scheduleId)
                .initiatedBy(initiatedBy)
                .status(status)
                .totalMachineCount(1)
                .dispatchedAt(dispatchedAt)
                .build());
    }
}
