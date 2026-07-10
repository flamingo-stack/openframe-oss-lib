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
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

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
