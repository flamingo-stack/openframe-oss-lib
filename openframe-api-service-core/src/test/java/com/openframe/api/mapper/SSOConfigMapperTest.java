package com.openframe.api.mapper;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.core.exception.ErrorCode;
import com.openframe.data.document.sso.SSOConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SSOConfigMapperTest {

    @Mock private EncryptionService encryptionService;

    private final SSOConfigMapper mapper = new SSOConfigMapper();

    @Test
    void updateEntity_newSecret_storesTheRequestedValuesWithTheNewSecretEncrypted() {
        SSOConfig existing = storedConfig("old-cipher");
        when(encryptionService.decryptClientSecret("old-cipher")).thenReturn("old-secret");
        when(encryptionService.encryptClientSecret("new-secret")).thenReturn("new-cipher");

        mapper.updateEntity(existing, request("new-secret"), encryptionService);

        assertThat(existing)
                .extracting(SSOConfig::getClientId, SSOConfig::getClientSecret, SSOConfig::isAutoProvisionUsers,
                        SSOConfig::getMsTenantId, SSOConfig::getAllowedDomains)
                .containsExactly("new-client", "new-cipher", true, "new-tenant", List.of("new.com"));
    }

    @Test
    void updateEntity_sameSecretAsStored_keepsTheStoredCiphertext() {
        SSOConfig existing = storedConfig("stored-cipher");
        when(encryptionService.decryptClientSecret("stored-cipher")).thenReturn("same-secret");

        mapper.updateEntity(existing, request("same-secret"), encryptionService);

        assertThat(existing.getClientSecret()).isEqualTo("stored-cipher");
        verify(encryptionService, never()).encryptClientSecret("same-secret");
    }

    @Test
    void updateEntity_noStoredSecret_encryptsTheRequestedSecretWithoutDecrypting() {
        SSOConfig existing = storedConfig(null);
        when(encryptionService.encryptClientSecret("new-secret")).thenReturn("new-cipher");

        mapper.updateEntity(existing, request("new-secret"), encryptionService);

        assertThat(existing.getClientSecret()).isEqualTo("new-cipher");
        verify(encryptionService, never()).decryptClientSecret(null);
    }

    @Test
    void updateEntity_storedSecretUnreadable_replacesItWithTheRequestedSecret() {
        SSOConfig existing = storedConfig("cipher-of-another-key");
        when(encryptionService.decryptClientSecret("cipher-of-another-key"))
                .thenThrow(new EncryptionException(ErrorCode.DECRYPTION_FAILED, "Failed to decrypt client secret"));
        when(encryptionService.encryptClientSecret("new-secret")).thenReturn("new-cipher");

        mapper.updateEntity(existing, request("new-secret"), encryptionService);

        assertThat(existing.getClientSecret()).isEqualTo("new-cipher");
    }

    private static SSOConfig storedConfig(String clientSecret) {
        SSOConfig config = new SSOConfig();
        config.setClientId("old-client");
        config.setClientSecret(clientSecret);
        config.setMsTenantId("old-tenant");
        config.setAllowedDomains(List.of("old.com"));
        return config;
    }

    private static SSOConfigRequest request(String clientSecret) {
        return SSOConfigRequest.builder()
                .clientId("new-client")
                .clientSecret(clientSecret)
                .autoProvisionUsers(true)
                .msTenantId("new-tenant")
                .allowedDomains(List.of("new.com"))
                .build();
    }
}
