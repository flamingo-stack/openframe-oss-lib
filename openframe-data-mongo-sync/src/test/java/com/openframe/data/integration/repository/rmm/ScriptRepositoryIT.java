package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptShell;
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
import org.springframework.data.mongodb.core.MongoTemplate;

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
        mongoTemplate.dropCollection(Script.class);
    }

    // ---------- save + audit fields ----------

    @Test
    @DisplayName("Given a Script saved without timestamps, when it is persisted, then createdAt and updatedAt are populated by Mongo auditing")
    void save_populatesAuditingTimestamps() {
        Script script = newScript(TENANT_A, "Restart Spooler");

        Script saved = scriptRepository.save(script);

        assertThat(saved.getId()).isNotBlank();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    // ---------- tenant isolation ----------

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

    // ---------- cursor pagination ----------

    @Test
    @DisplayName("Given several scripts in a tenant and no cursor, when findPageForTenant runs, then they come back newest-first by _id")
    void findPageForTenant_noCursor_returnsNewestFirst() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 5);

        List<Script> page = scriptRepository.findPageForTenant(TENANT_A, null, false, 10);

        assertThat(page).hasSize(5);
        assertThat(page.get(0).getId()).isEqualTo(seeded.get(4).getId());
        assertThat(page.get(4).getId()).isEqualTo(seeded.get(0).getId());
    }

    @Test
    @DisplayName("Given a forward cursor, when findPageForTenant runs, then only rows with _id older than the cursor are returned (newest-first)")
    void findPageForTenant_forwardCursor_returnsOlderRows() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 5);
        String cursor = seeded.get(2).getId();

        List<Script> page = scriptRepository.findPageForTenant(TENANT_A, cursor, false, 10);

        assertThat(page).extracting(Script::getId)
                .containsExactly(seeded.get(1).getId(), seeded.get(0).getId());
    }

    @Test
    @DisplayName("Given a backward cursor, when findPageForTenant runs, then rows with _id newer than the cursor are returned in ASC order (caller reverses for display)")
    void findPageForTenant_backwardCursor_returnsNewerRowsAscending() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 5);
        String cursor = seeded.get(2).getId();

        List<Script> page = scriptRepository.findPageForTenant(TENANT_A, cursor, true, 10);

        assertThat(page).extracting(Script::getId)
                .containsExactly(seeded.get(3).getId(), seeded.get(4).getId());
    }

    @Test
    @DisplayName("Given mixed-tenant data, when findPageForTenant runs for one tenant, then only that tenant's rows are returned")
    void findPageForTenant_isolatesByTenant() {
        seedSequentialForTenant(TENANT_A, 3);
        seedSequentialForTenant(TENANT_B, 3);

        List<Script> aPage = scriptRepository.findPageForTenant(TENANT_A, null, false, 10);

        assertThat(aPage).hasSize(3);
        assertThat(aPage).allSatisfy(s -> assertThat(s.getTenantId()).isEqualTo(TENANT_A));
    }

    @Test
    @DisplayName("Given more rows than the limit, when findPageForTenant runs with that limit, then exactly limit rows are returned (the limit is honoured)")
    void findPageForTenant_respectsLimit() {
        seedSequentialForTenant(TENANT_A, 5);

        List<Script> page = scriptRepository.findPageForTenant(TENANT_A, null, false, 2);

        assertThat(page).hasSize(2);
    }

    @Test
    @DisplayName("Given an invalid (non-ObjectId) cursor, when findPageForTenant runs, then it gracefully falls back to the first page rather than throwing")
    void findPageForTenant_invalidCursor_fallsBackToFirstPage() {
        List<Script> seeded = seedSequentialForTenant(TENANT_A, 3);

        List<Script> page = scriptRepository.findPageForTenant(TENANT_A, "not-an-objectid", false, 10);

        assertThat(page).hasSize(3);
        assertThat(page.get(0).getId()).isEqualTo(seeded.get(2).getId());
    }

    // ---------- exists checks ----------

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

    // ---------- delete ----------

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

    // ---------- compound unique index ----------

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

    // ---------- helpers ----------

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
