package com.openframe.api.mapper;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.support.TestEncryption;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.sso.SSOConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;
import static com.openframe.core.crypto.service.SecretPurpose.SSO_CLIENT_SECRET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SSOConfigMapperTest {

    private static final String TENANT = TestEncryption.TENANT;
    private static final EncryptionContext SSO_CONTEXT = EncryptionContext.forTenant(TENANT, SSO_CLIENT_SECRET);

    private final EncryptionService encryptionService = TestEncryption.SERVICE;
    private final SSOConfigMapper mapper = new SSOConfigMapper(TestEncryption.tenant());

    private static SSOConfigRequest request(String clientSecret) {
        return SSOConfigRequest.builder().clientId("client-id").clientSecret(clientSecret).build();
    }

    @Test
    @DisplayName("toEntity: the client secret is stored as ciphertext for the pod's tenant and the SSO purpose")
    void toEntity_storesSecretForThePodTenant() {
        SSOConfig config = mapper.toEntity("google", request("client-secret"), encryptionService);

        assertThat(config.getClientSecret()).doesNotContain("client-secret");
        assertThat(encryptionService.decrypt(config.getClientSecret(), SSO_CONTEXT)).isEqualTo("client-secret");
    }

    @Test
    @DisplayName("toEntity: the stored secret is unreadable for another tenant, another purpose or the platform")
    void toEntity_secretUnreadableUnderAnotherContext() {
        String stored = mapper.toEntity("google", request("client-secret"), encryptionService).getClientSecret();

        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", SSO_CLIENT_SECRET)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant(TENANT, SCRIPT_ENV_VAR)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.platform(SSO_CLIENT_SECRET)))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("updateEntity: the new client secret replaces the old one as ciphertext for the pod's tenant")
    void updateEntity_storesNewSecretForThePodTenant() {
        SSOConfig existing = mapper.toEntity("google", request("old-secret"), encryptionService);

        mapper.updateEntity(existing, request("new-secret"), encryptionService);

        assertThat(existing.getClientSecret()).doesNotContain("new-secret");
        assertThat(encryptionService.decrypt(existing.getClientSecret(), SSO_CONTEXT)).isEqualTo("new-secret");
        assertThatThrownBy(() -> encryptionService.decrypt(existing.getClientSecret(),
                EncryptionContext.forTenant("tenant-2", SSO_CLIENT_SECRET)))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("toEntity: the pod's tenant decides the context, whatever tenant another pod would use")
    void toEntity_followsTheTenantFromTheProvider() {
        SSOConfigMapper otherPod = new SSOConfigMapper(TestEncryption.tenant("tenant-2"));

        String stored = otherPod.toEntity("google", request("client-secret"), encryptionService).getClientSecret();

        assertThat(encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", SSO_CLIENT_SECRET)))
                .isEqualTo("client-secret");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, SSO_CONTEXT)).isInstanceOf(EncryptionException.class);
    }

    // Kept from main (#3118): an unchanged secret keeps its ciphertext; an empty or unreadable one is replaced.
    @Test
    @DisplayName("updateEntity: the same secret as stored keeps the stored ciphertext")
    void updateEntity_sameSecretAsStored_keepsTheStoredCiphertext() {
        SSOConfig existing = mapper.toEntity("google", request("same-secret"), encryptionService);
        String stored = existing.getClientSecret();

        mapper.updateEntity(existing, request("same-secret"), encryptionService);

        assertThat(existing.getClientSecret()).isEqualTo(stored);
    }

    @Test
    @DisplayName("updateEntity: with no stored secret the requested one is encrypted")
    void updateEntity_noStoredSecret_encryptsTheRequestedSecret() {
        SSOConfig existing = new SSOConfig();

        mapper.updateEntity(existing, request("new-secret"), encryptionService);

        assertThat(encryptionService.decrypt(existing.getClientSecret(), SSO_CONTEXT)).isEqualTo("new-secret");
    }

    @Test
    @DisplayName("updateEntity: a stored secret that does not decrypt is replaced with the requested one")
    void updateEntity_storedSecretUnreadable_replacesIt() {
        SSOConfig existing = new SSOConfig();
        existing.setClientSecret(encryptionService.encrypt("old-secret",
                EncryptionContext.forTenant("tenant-2", SSO_CLIENT_SECRET)));

        mapper.updateEntity(existing, request("new-secret"), encryptionService);

        assertThat(encryptionService.decrypt(existing.getClientSecret(), SSO_CONTEXT)).isEqualTo("new-secret");
    }
}
