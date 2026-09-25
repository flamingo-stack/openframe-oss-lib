package com.openframe.data.integration.repository.tenant;

import com.openframe.data.document.tenant.TenantKey;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.TenantKeyIntegrationTestApplication;
import com.openframe.data.repository.tenant.TenantKeyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = TenantKeyIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TenantKeyRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String TENANT_B = "tenant-b";

    @Autowired
    private TenantKeyRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        // Clear documents but keep indexes — dropCollection() would also drop the
        // partial unique index, and auto-index-creation runs only at startup.
        mongoTemplate.remove(new Query(), TenantKey.class);
    }

    @Test
    @DisplayName("Given an active key for a tenant, when a second active key is saved for it, then the unique index rejects it")
    void uniqueIndex_rejectsSecondActiveKeyForTenant() {
        repository.save(newKey(TENANT_A, true));

        assertThatThrownBy(() -> repository.save(newKey(TENANT_A, true)))
                .isInstanceOf(DuplicateKeyException.class);
        assertThat(repository.findAll()).hasSize(1);
    }

    @Test
    @DisplayName("Given an active key for a tenant, when inactive keys are saved for it, then they coexist — the index only covers active keys")
    void uniqueIndex_allowsInactiveKeysAlongsideActive() {
        repository.save(newKey(TENANT_A, true));
        repository.save(newKey(TENANT_A, false));
        repository.save(newKey(TENANT_A, false));

        assertThat(repository.findAll()).hasSize(3);
        assertThat(repository.findFirstByTenantIdAndActiveTrue(TENANT_A)).isPresent();
    }

    @Test
    @DisplayName("Given a tenant's active key is deactivated, when a new active key is saved, then it is accepted")
    void uniqueIndex_allowsNewActiveKeyAfterDeactivation() {
        TenantKey old = repository.save(newKey(TENANT_A, true));
        old.setActive(false);
        repository.save(old);

        TenantKey next = repository.save(newKey(TENANT_A, true));

        assertThat(repository.findFirstByTenantIdAndActiveTrue(TENANT_A))
                .get().extracting(TenantKey::getKeyId).isEqualTo(next.getKeyId());
    }

    @Test
    @DisplayName("Given an active key for one tenant, when another tenant saves an active key, then both coexist — uniqueness is per tenant")
    void uniqueIndex_isPerTenant() {
        repository.save(newKey(TENANT_A, true));
        repository.save(newKey(TENANT_B, true));

        assertThat(repository.findFirstByTenantIdAndActiveTrue(TENANT_A)).isPresent();
        assertThat(repository.findFirstByTenantIdAndActiveTrue(TENANT_B)).isPresent();
    }

    private static TenantKey newKey(String tenantId, boolean active) {
        TenantKey key = new TenantKey();
        key.setId(UUID.randomUUID().toString());
        key.setTenantId(tenantId);
        key.setKeyId("kid-" + UUID.randomUUID());
        key.setPublicPem("public-pem");
        key.setPrivateEncrypted("private-encrypted");
        key.setActive(active);
        return key;
    }
}
