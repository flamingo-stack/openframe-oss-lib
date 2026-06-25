package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptExecutionStatus;
import com.openframe.data.document.rmm.filter.ScriptExecutionQueryFilter;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration coverage for {@code CustomScriptExecutionRepositoryImpl} — the
 * id-cursor pagination moved out of {@code ScriptExecutionService} into the data
 * layer. Mirrors {@code ScriptRepositoryIT}: a real Mongo (Testcontainers)
 * exercises the {@code Criteria}/cursor/sort assembly that cannot be unit-tested
 * against a mocked {@code MongoTemplate}.
 */
@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ScriptExecutionRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";
    private static final String SCRIPT_1 = "script-1";
    private static final String SCRIPT_2 = "script-2";
    private static final String FIELD_ID = "_id";

    @Autowired
    private ScriptExecutionRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        // Clear documents but keep indexes (dropCollection would drop the unique
        // compound index, only recreated at application startup).
        mongoTemplate.remove(new Query(), ScriptExecution.class);
    }

    @Test
    @DisplayName("countForScript: counts only rows of the given (tenant, script), ignoring other scripts and other tenants")
    void countForScript_scopesByTenantAndScript() {
        save(TENANT_A, SCRIPT_1);
        save(TENANT_A, SCRIPT_1);
        save(TENANT_A, SCRIPT_2);   // different script
        save(TENANT_B, SCRIPT_1);   // different tenant, same scriptId

        assertThat(repository.countForScript(TENANT_A, SCRIPT_1, null)).isEqualTo(2);
        assertThat(repository.countForScript(TENANT_A, SCRIPT_2, null)).isEqualTo(1);
        assertThat(repository.countForScript(TENANT_B, SCRIPT_1, null)).isEqualTo(1);
    }

    @Test
    @DisplayName("findPageForScript: default _id DESC returns newest-first")
    void findPageForScript_defaultIdDescNewestFirst() {
        ScriptExecution r1 = save(TENANT_A, SCRIPT_1);
        ScriptExecution r2 = save(TENANT_A, SCRIPT_1);
        ScriptExecution r3 = save(TENANT_A, SCRIPT_1);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1, null, FIELD_ID, Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptExecution::getId)
                .containsExactly(r3.getId(), r2.getId(), r1.getId());
    }

    @Test
    @DisplayName("findPageForScript: forward + DESC cursor returns the rows strictly OLDER than the cursor (_id < cursor)")
    void findPageForScript_forwardCursorReturnsOlderRows() {
        ScriptExecution r1 = save(TENANT_A, SCRIPT_1);
        ScriptExecution r2 = save(TENANT_A, SCRIPT_1);
        ScriptExecution r3 = save(TENANT_A, SCRIPT_1);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1, null, FIELD_ID, Sort.Direction.DESC, r3.getId(), false, 10);

        assertThat(page).extracting(ScriptExecution::getId)
                .containsExactly(r2.getId(), r1.getId());
    }

    @Test
    @DisplayName("findPageForScript: limit caps the number of rows returned (the 'fetch limit+1' caller passes limit+1)")
    void findPageForScript_limitCapsRows() {
        save(TENANT_A, SCRIPT_1);
        save(TENANT_A, SCRIPT_1);
        save(TENANT_A, SCRIPT_1);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1, null, FIELD_ID, Sort.Direction.DESC, null, false, 2);

        assertThat(page).hasSize(2);
    }

    @Test
    @DisplayName("findPageForScript: backward + DESC flips the comparator (_id > cursor) and walks in ASC order — the service reverses for display")
    void findPageForScript_backwardFlipsComparator() {
        ScriptExecution r1 = save(TENANT_A, SCRIPT_1);
        ScriptExecution r2 = save(TENANT_A, SCRIPT_1);
        ScriptExecution r3 = save(TENANT_A, SCRIPT_1);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1, null, FIELD_ID, Sort.Direction.DESC, r1.getId(), true, 10);

        // _id > r1, returned in ASC (flipped) order
        assertThat(page).extracting(ScriptExecution::getId)
                .containsExactly(r2.getId(), r3.getId());
    }

    @Test
    @DisplayName("findPageForScript: never leaks another tenant's rows even for the same scriptId")
    void findPageForScript_tenantIsolation() {
        save(TENANT_A, SCRIPT_1);
        ScriptExecution other = save(TENANT_B, SCRIPT_1);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1, null, FIELD_ID, Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptExecution::getId).doesNotContain(other.getId());
        assertThat(page).allSatisfy(row -> assertThat(row.getTenantId()).isEqualTo(TENANT_A));
    }

    @Test
    @DisplayName("findPageForScript: an invalid (non-ObjectId) cursor is treated as 'no cursor' — first page, not an error")
    void findPageForScript_invalidCursorFallsBackToFirstPage() {
        save(TENANT_A, SCRIPT_1);
        save(TENANT_A, SCRIPT_1);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1, null, FIELD_ID, Sort.Direction.DESC, "not-an-objectid", false, 10);

        assertThat(page).hasSize(2);
    }

    @Test
    @DisplayName("sort allowlist: dispatchedAt/finishedAt/statusChangedAt/_id are sortable; an arbitrary field is not; default is _id")
    void sortAllowlistAndDefault() {
        assertThat(repository.isSortableField("dispatchedAt")).isTrue();
        assertThat(repository.isSortableField("finishedAt")).isTrue();
        assertThat(repository.isSortableField("statusChangedAt")).isTrue();
        assertThat(repository.isSortableField(FIELD_ID)).isTrue();
        assertThat(repository.isSortableField("stdout")).isFalse();
        assertThat(repository.isSortableField(null)).isFalse();
        assertThat(repository.getDefaultSortField()).isEqualTo(FIELD_ID);
    }

    @Test
    @DisplayName("findPageForScript: filters by status — only rows whose status is in the filter set are returned")
    void findPageForScript_filtersByStatus() {
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.RUNNING);
        ScriptExecution success = save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.SUCCESS);
        ScriptExecution failed = save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.FAILED);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1,
                filter(ScriptExecutionStatus.SUCCESS, ScriptExecutionStatus.FAILED),
                FIELD_ID, Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(ScriptExecution::getId)
                .containsExactlyInAnyOrder(success.getId(), failed.getId());
    }

    @Test
    @DisplayName("countForScript: filters by status — counts only rows whose status is in the filter set")
    void countForScript_filtersByStatus() {
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.RUNNING);
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.RUNNING);
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.SUCCESS);

        assertThat(repository.countForScript(TENANT_A, SCRIPT_1, filter(ScriptExecutionStatus.RUNNING))).isEqualTo(2);
        assertThat(repository.countForScript(TENANT_A, SCRIPT_1, filter(ScriptExecutionStatus.SUCCESS))).isEqualTo(1);
        assertThat(repository.countForScript(TENANT_A, SCRIPT_1, filter(ScriptExecutionStatus.FAILED))).isZero();
    }

    @Test
    @DisplayName("findPageForScript: a filter with no statuses imposes no status constraint — all rows returned")
    void findPageForScript_emptyStatuses_noConstraint() {
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.RUNNING);
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.SUCCESS);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1,
                ScriptExecutionQueryFilter.builder().build(),   // statuses == null
                FIELD_ID, Sort.Direction.DESC, null, false, 10);

        assertThat(page).hasSize(2);
    }

    @Test
    @DisplayName("findPageForScript: an explicitly EMPTY statuses list imposes no constraint (the !isEmpty guard) — all rows returned, same as null")
    void findPageForScript_emptyListStatuses_noConstraint() {
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.RUNNING);
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.SUCCESS);

        var page = repository.findPageForScript(TENANT_A, SCRIPT_1,
                filter(),   // empty statuses list — must NOT become `status IN []` (which matches nothing)
                FIELD_ID, Sort.Direction.DESC, null, false, 10);

        assertThat(page).hasSize(2);
    }

    @Test
    @DisplayName("findPageForScript: the status filter AND the cursor predicate combine on the same query (no Spring Data 'second field criteria' conflict) — only matching rows older than the cursor")
    void findPageForScript_statusFilterCombinesWithCursor() {
        ScriptExecution r1 = save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.SUCCESS);
        save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.RUNNING);   // r2 — filtered out by status
        ScriptExecution r3 = save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.SUCCESS);
        ScriptExecution r4 = save(TENANT_A, SCRIPT_1, ScriptExecutionStatus.SUCCESS);

        // status=SUCCESS AND _id < r4, DESC → [r3, r1] (r4 excluded by cursor, r2 by status)
        var page = repository.findPageForScript(TENANT_A, SCRIPT_1,
                filter(ScriptExecutionStatus.SUCCESS),
                FIELD_ID, Sort.Direction.DESC, r4.getId(), false, 10);

        assertThat(page).extracting(ScriptExecution::getId)
                .containsExactly(r3.getId(), r1.getId());
    }

    private static ScriptExecutionQueryFilter filter(ScriptExecutionStatus... statuses) {
        return ScriptExecutionQueryFilter.builder().statuses(java.util.List.of(statuses)).build();
    }

    private ScriptExecution save(String tenantId, String scriptId) {
        return save(tenantId, scriptId, ScriptExecutionStatus.RUNNING);
    }

    private ScriptExecution save(String tenantId, String scriptId, ScriptExecutionStatus status) {
        Instant now = Instant.now();
        return repository.save(ScriptExecution.builder()
                .tenantId(tenantId)
                .executionId("exec-" + System.nanoTime())
                .scriptId(scriptId)
                .machineId("machine-1")
                .privilegeLevel(PrivilegeLevel.USER)
                .status(status)
                .dispatchedAt(now)
                .statusChangedAt(now)
                .build());
    }
}
