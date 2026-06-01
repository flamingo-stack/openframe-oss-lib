package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.rmm.filter.ScriptQueryFilter;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import com.openframe.data.repository.rmm.ScriptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class ScriptRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";

    @Autowired
    private ScriptRepository scriptRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        // Clear documents but keep indexes — dropCollection() would also drop the
        // compound unique index, and Spring Data's auto-index-creation runs only
        // at application startup, so subsequent saves would silently lose the
        // unique constraint enforcement.
        mongoTemplate.remove(new Query(), Script.class);
    }

    @Test
    @DisplayName("Given a Script saved without timestamps, when it is persisted, then createdAt and updatedAt are populated by Mongo auditing")
    void save_populatesAuditingTimestamps() {
        Script script = newScript(TENANT_A, "Restart Spooler");

        Script saved = scriptRepository.save(script);

        assertThat(saved.getId()).isNotBlank();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    @DisplayName("Given two tenants with a script each, when findByTenantIdAndId is called with tenant A, then only tenant A's script is returned even if the id matches tenant B's")
    void findByTenantIdAndId_isolatesByTenant() {
        Script a = scriptRepository.save(newScript(TENANT_A, "A"));
        Script b = scriptRepository.save(newScript(TENANT_B, "B"));

        assertThat(scriptRepository.findByTenantIdAndId(TENANT_A, a.getId())).isPresent();
        assertThat(scriptRepository.findByTenantIdAndId(TENANT_B, a.getId())).isEmpty();
        assertThat(scriptRepository.findByTenantIdAndId(TENANT_A, b.getId())).isEmpty();
    }

    @Test
    @DisplayName("Given a script in tenant A with name X, when findByTenantIdAndName is queried in tenant B with the same name, then no document is returned")
    void findByTenantIdAndName_isolatesByTenant() {
        scriptRepository.save(newScript(TENANT_A, "same-name"));

        Optional<Script> result = scriptRepository.findByTenantIdAndName(TENANT_B, "same-name");

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Given several scripts in a tenant and no cursor, when findPageForTenant runs, then they come back newest-first by _id")
    void findPageForTenant_noCursor_returnsNewestFirst() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 5);

        List<Script> page = scriptRepository.findPageForTenant(TENANT_A, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).hasSize(5);
        assertThat(page.get(0).getId()).isEqualTo(seeded.get(4).getId());
        assertThat(page.get(4).getId()).isEqualTo(seeded.get(0).getId());
    }

    @Test
    @DisplayName("Given a forward cursor, when findPageForTenant runs, then only rows with _id older than the cursor are returned (newest-first)")
    void findPageForTenant_forwardCursor_returnsOlderRows() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 5);
        String cursor = seeded.get(2).getId();

        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, cursor, false, 10);

        assertThat(page).extracting(Script::getId)
                .containsExactly(seeded.get(1).getId(), seeded.get(0).getId());
    }

    @Test
    @DisplayName("Given a backward cursor, when findPageForTenant runs, then rows with _id newer than the cursor are returned in ASC order (caller reverses for display)")
    void findPageForTenant_backwardCursor_returnsNewerRowsAscending() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 5);
        String cursor = seeded.get(2).getId();

        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, cursor, true, 10);

        assertThat(page).extracting(Script::getId)
                .containsExactly(seeded.get(3).getId(), seeded.get(4).getId());
    }

    @Test
    @DisplayName("Given mixed-tenant data, when findPageForTenant runs for one tenant, then only that tenant's rows are returned")
    void findPageForTenant_isolatesByTenant() {
        seedSequentialForTenant(TENANT_A, 3);
        seedSequentialForTenant(TENANT_B, 3);

        List<Script> aPage = scriptRepository.findPageForTenant(TENANT_A, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(aPage).hasSize(3);
        assertThat(aPage).allSatisfy(s -> assertThat(s.getTenantId()).isEqualTo(TENANT_A));
    }

    @Test
    @DisplayName("Given more rows than the limit, when findPageForTenant runs with that limit, then exactly limit rows are returned (the limit is honoured)")
    void findPageForTenant_respectsLimit() {
        seedSequentialForTenant(TENANT_A, 5);

        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, null, false, 2);

        assertThat(page).hasSize(2);
    }

    @Test
    @DisplayName("Given a mix of ACTIVE and DELETED scripts in a tenant, when findPageForTenant runs, then DELETED scripts are excluded from the result (default list view)")
    void findPageForTenant_excludesDeletedScripts() {
        Script keep1 = scriptRepository.save(newScript(TENANT_A, "keep-1"));
        Script doomed = scriptRepository.save(newScript(TENANT_A, "doomed"));
        Script keep2 = scriptRepository.save(newScript(TENANT_A, "keep-2"));
        // Soft-delete the middle one
        doomed.setStatus(ScriptStatus.DELETED);
        scriptRepository.save(doomed);

        List<Script> page = scriptRepository.findPageForTenant(TENANT_A, null, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(Script::getId)
                .containsExactlyInAnyOrder(keep1.getId(), keep2.getId())
                .doesNotContain(doomed.getId());
    }

    @Test
    @DisplayName("Given an invalid (non-ObjectId) cursor, when findPageForTenant runs, then it gracefully falls back to the first page rather than throwing")
    void findPageForTenant_invalidCursor_fallsBackToFirstPage() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 3);

        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, null, null, "_id", Sort.Direction.DESC, "not-an-objectid", false, 10);

        assertThat(page).hasSize(3);
        assertThat(page.get(0).getId()).isEqualTo(seeded.get(2).getId());
    }

    @Test
    @DisplayName("Given a script with name X in tenant A, when existsByTenantIdAndName is called in tenant B with the same name, then false is returned")
    void existsByTenantIdAndName_isolatesByTenant() {
        scriptRepository.save(newScript(TENANT_A, "shared"));

        assertThat(scriptRepository.existsByTenantIdAndName(TENANT_A, "shared")).isTrue();
        assertThat(scriptRepository.existsByTenantIdAndName(TENANT_B, "shared")).isFalse();
    }

    @Test
    @DisplayName("Given a script being edited (its own name), when existsByTenantIdAndNameAndIdNot checks against the same name, then false is returned — the document does not collide with itself")
    void existsByTenantIdAndNameAndIdNot_excludesEditedDocument() {
        Script saved = scriptRepository.save(newScript(TENANT_A, "X"));

        boolean collides = scriptRepository.existsByTenantIdAndNameAndIdNot(TENANT_A, "X", saved.getId());

        assertThat(collides).isFalse();
    }

    @Test
    @DisplayName("Given two scripts in the same tenant, when existsByTenantIdAndNameAndIdNot checks the other script's name while editing one of them, then true is returned (real collision)")
    void existsByTenantIdAndNameAndIdNot_detectsRealCollision() {
        Script keep = scriptRepository.save(newScript(TENANT_A, "keep"));
        Script editing = scriptRepository.save(newScript(TENANT_A, "editing"));

        boolean collides = scriptRepository.existsByTenantIdAndNameAndIdNot(TENANT_A, keep.getName(), editing.getId());

        assertThat(collides).isTrue();
    }

    @Test
    @DisplayName("Given a script in tenant A, when deleteByTenantIdAndId is called with tenant A and that id, then 1 is returned and the document is gone")
    void deleteByTenantIdAndId_removesAndReturnsOne() {
        Script saved = scriptRepository.save(newScript(TENANT_A, "to-delete"));

        long removed = scriptRepository.deleteByTenantIdAndId(TENANT_A, saved.getId());

        assertThat(removed).isEqualTo(1L);
        assertThat(scriptRepository.findByTenantIdAndId(TENANT_A, saved.getId())).isEmpty();
    }

    @Test
    @DisplayName("Given a script in tenant A, when deleteByTenantIdAndId is called with tenant B and the same id, then 0 is returned and the document is preserved (cross-tenant delete is impossible)")
    void deleteByTenantIdAndId_doesNotCrossTenants() {
        Script saved = scriptRepository.save(newScript(TENANT_A, "preserved"));

        long removed = scriptRepository.deleteByTenantIdAndId(TENANT_B, saved.getId());

        assertThat(removed).isZero();
        assertThat(scriptRepository.findByTenantIdAndId(TENANT_A, saved.getId())).isPresent();
    }

    @Test
    @DisplayName("Given an empty collection, when deleteByTenantIdAndId is called with a non-existent id, then 0 is returned (idempotent)")
    void deleteByTenantIdAndId_nonExistent_returnsZero() {
        long removed = scriptRepository.deleteByTenantIdAndId(TENANT_A, "65f4a8000000000000000099");

        assertThat(removed).isZero();
    }

    @Test
    @DisplayName("Given a script with name X in tenant A, when saving another script with the same (tenantId, name) pair, then Mongo rejects the second insert with a DuplicateKeyException (compound unique index)")
    void compoundUniqueIndex_enforced_OnTenantAndName() {
        scriptRepository.save(newScript(TENANT_A, "unique-name"));

        assertThatThrownBy(() -> scriptRepository.save(newScript(TENANT_A, "unique-name")))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    @DisplayName("Given a script with name X in tenant A, when saving a script with the same name X in tenant B, then both coexist — name uniqueness is per tenant, not global")
    void compoundUniqueIndex_doesNotCollideAcrossTenants() {
        scriptRepository.save(newScript(TENANT_A, "same-name"));
        Script b = scriptRepository.save(newScript(TENANT_B, "same-name"));

        assertThat(b.getId()).isNotBlank();
        assertThat(scriptRepository.findByTenantIdAndName(TENANT_A, "same-name")).isPresent();
        assertThat(scriptRepository.findByTenantIdAndName(TENANT_B, "same-name")).isPresent();
    }

    @Test
    @DisplayName("Given scripts with mixed shells across two tenants, when filter.shells = [BASH] for tenant A, then only A's BASH script comes back — tenant B's BASH script is NOT returned (filter + tenant isolation hold together)")
    void findPageForTenant_filterByShells_respectsTenantIsolation() {
        // Tenant A: one PowerShell + one BASH
        scriptRepository.save(Script.builder().tenantId(TENANT_A).name("a-ps")
                .shell(ScriptShell.POWERSHELL).scriptBody("...").build());
        Script aBash = scriptRepository.save(Script.builder().tenantId(TENANT_A).name("a-bash")
                .shell(ScriptShell.BASH).scriptBody("...").build());
        // Tenant B: a BASH script that MUST NOT leak into tenant A's result
        Script bBash = scriptRepository.save(Script.builder().tenantId(TENANT_B).name("b-bash")
                .shell(ScriptShell.BASH).scriptBody("...").build());

        ScriptQueryFilter filter = ScriptQueryFilter.builder().shells(List.of(ScriptShell.BASH)).build();
        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, filter, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(Script::getId)
                .containsExactly(aBash.getId())
                .doesNotContain(bBash.getId());
    }

    @Test
    @DisplayName("Given an explicit statuses filter that includes DELETED, when findPageForTenant runs, then DELETED scripts ARE returned (admin audit path)")
    void findPageForTenant_explicitDeletedStatus_includesDeleted() {
        Script kept = scriptRepository.save(newScript(TENANT_A, "kept"));
        Script gone = scriptRepository.save(newScript(TENANT_A, "gone"));
        gone.setStatus(ScriptStatus.DELETED);
        scriptRepository.save(gone);

        ScriptQueryFilter filter = ScriptQueryFilter.builder().statuses(List.of(ScriptStatus.DELETED)).build();
        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, filter, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(Script::getId).containsExactly(gone.getId()).doesNotContain(kept.getId());
    }

    @Test
    @DisplayName("Given supportedPlatforms filter, when findPageForTenant runs, then scripts whose platforms list contains ANY of the requested are returned")
    void findPageForTenant_filterByPlatform() {
        scriptRepository.save(Script.builder().tenantId(TENANT_A).name("win-only").shell(ScriptShell.POWERSHELL)
                .scriptBody("...").supportedPlatforms(List.of(ScriptPlatform.WINDOWS)).build());
        Script crossPlatform = scriptRepository.save(Script.builder().tenantId(TENANT_A).name("multi").shell(ScriptShell.BASH)
                .scriptBody("...").supportedPlatforms(List.of(ScriptPlatform.LINUX, ScriptPlatform.MACOS)).build());

        ScriptQueryFilter filter = ScriptQueryFilter.builder().supportedPlatforms(List.of(ScriptPlatform.LINUX)).build();
        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, filter, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(Script::getId).containsExactly(crossPlatform.getId());
    }

    @Test
    @DisplayName("Given a tag filter, when findPageForTenant runs, then case-insensitive exact match is applied")
    void findPageForTenant_filterByTag_caseInsensitive() {
        scriptRepository.save(Script.builder().tenantId(TENANT_A).name("a").shell(ScriptShell.BASH).scriptBody("...").tag("Maintenance").build());
        scriptRepository.save(Script.builder().tenantId(TENANT_A).name("b").shell(ScriptShell.BASH).scriptBody("...").tag("Diagnostics").build());

        ScriptQueryFilter filter = ScriptQueryFilter.builder().tag("MAINTENANCE").build();
        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, filter, null, "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(Script::getName).containsExactly("a");
    }

    @Test
    @DisplayName("Given a search string, when findPageForTenant runs, then scripts whose name contains the substring (case-insensitive) are returned")
    void findPageForTenant_search_matchesNameSubstring() {
        scriptRepository.save(newScript(TENANT_A, "Backup nightly"));
        scriptRepository.save(newScript(TENANT_A, "BACKUP weekly"));
        scriptRepository.save(newScript(TENANT_A, "Restart printer spooler"));

        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, null, "backup", "_id", Sort.Direction.DESC, null, false, 10);

        assertThat(page).extracting(Script::getName)
                .containsExactlyInAnyOrder("Backup nightly", "BACKUP weekly");
    }

    @Test
    @DisplayName("Given sort by name ASC, when findPageForTenant runs, then results come back alphabetically")
    void findPageForTenant_sortByNameAsc() {
        scriptRepository.save(newScript(TENANT_A, "zeta"));
        scriptRepository.save(newScript(TENANT_A, "alpha"));
        scriptRepository.save(newScript(TENANT_A, "mike"));

        List<Script> page = scriptRepository.findPageForTenant(
                TENANT_A, null, null, "name", Sort.Direction.ASC, null, false, 10);

        assertThat(page).extracting(Script::getName).containsExactly("alpha", "mike", "zeta");
    }

    @Test
    @DisplayName("isSortableField: returns true for whitelisted fields and false for arbitrary input (no SQL-injection-style fields pass through)")
    void isSortableField_enforcesAllowlist() {
        assertThat(scriptRepository.isSortableField("_id")).isTrue();
        assertThat(scriptRepository.isSortableField("name")).isTrue();
        assertThat(scriptRepository.isSortableField("createdAt")).isTrue();
        assertThat(scriptRepository.isSortableField("updatedAt")).isTrue();
        assertThat(scriptRepository.isSortableField("scriptBody")).isFalse();
        assertThat(scriptRepository.isSortableField("malicious; drop_database")).isFalse();
        assertThat(scriptRepository.isSortableField(null)).isFalse();
    }

    @Test
    @DisplayName("getDefaultSortField: returns _id (newest-first ordering)")
    void getDefaultSortField_isId() {
        assertThat(scriptRepository.getDefaultSortField()).isEqualTo("_id");
    }


    private static Script newScript(String tenantId, String name) {
        return Script.builder()
                .tenantId(tenantId)
                .name(name)
                .shell(ScriptShell.POWERSHELL)
                .scriptBody("echo " + name)
                .build();
    }

    /**
     * Seed N scripts for the tenant, saving them one-by-one so each gets a
     * monotonically increasing {@code ObjectId}. The returned list is in
     * insertion order, so {@code seeded.get(0)} is the oldest and
     * {@code seeded.get(N-1)} is the newest.
     */
    private List<Script> seedSequentialForTenant(String tenantId, int count) {
        List<Script> saved = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            saved.add(scriptRepository.save(newScript(tenantId, tenantId + "-" + i)));
        }
        return saved;
    }
}
