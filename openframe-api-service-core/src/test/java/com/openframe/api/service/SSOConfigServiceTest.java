package com.openframe.api.service;

import com.openframe.api.config.SSOProperties;
import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.api.mapper.SSOConfigMapper;
import com.openframe.api.service.processor.SSOConfigProcessor;
import com.openframe.api.support.TestEncryption;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.repository.sso.SSOConfigRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static com.openframe.core.crypto.service.SecretPurpose.AI_PROVIDER_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.SSO_CLIENT_SECRET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SSOConfigServiceTest {

    private static final String TENANT = TestEncryption.TENANT;
    private static final EncryptionContext SSO_CONTEXT = EncryptionContext.forTenant(TENANT, SSO_CLIENT_SECRET);

    private final EncryptionService encryptionService = TestEncryption.SERVICE;
    private final SSOConfigRepository repository = mock(SSOConfigRepository.class);
    private SSOConfigService service;

    @BeforeEach
    void setUp() {
        service = new SSOConfigService(repository, encryptionService, new SSOProperties(), mock(SSOConfigProcessor.class),
                new SSOConfigMapper(TestEncryption.tenant()), mock(DomainValidationService.class),
                mock(EmailDomainPolicy.class), TestEncryption.tenant());
    }

    private void givenStoredConfig(String encryptedSecret) {
        SSOConfig config = new SSOConfig();
        config.setTenantId(TENANT);
        config.setProvider("google");
        config.setClientId("client-id");
        config.setClientSecret(encryptedSecret);
        config.setEnabled(true);
        when(repository.findByProvider("google")).thenReturn(Optional.of(config));
    }

    @Test
    @DisplayName("getConfig: the stored secret comes back decrypted with the pod's tenant and the SSO purpose")
    void getConfig_decryptsWithThePodTenant() {
        givenStoredConfig(encryptionService.encrypt("client-secret", SSO_CONTEXT));

        SSOConfigResponse response = service.getConfig("google");

        assertThat(response.getClientSecret()).isEqualTo("client-secret");
    }

    @Test
    @DisplayName("getConfig: a secret encrypted for another tenant fails instead of coming back")
    void getConfig_secretOfAnotherTenant_fails() {
        givenStoredConfig(encryptionService.encrypt("client-secret", EncryptionContext.forTenant("tenant-2", SSO_CLIENT_SECRET)));

        assertThatThrownBy(() -> service.getConfig("google")).isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("getConfig: a secret encrypted for another purpose fails instead of coming back")
    void getConfig_secretOfAnotherPurpose_fails() {
        givenStoredConfig(encryptionService.encrypt("client-secret", EncryptionContext.forTenant(TENANT, AI_PROVIDER_KEY)));

        assertThatThrownBy(() -> service.getConfig("google")).isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("upsertConfig (new): the saved secret is ciphertext readable only with the pod's tenant context")
    void upsertConfig_new_savesSecretForThePodTenant() {
        when(repository.findByProvider("google")).thenReturn(Optional.empty());
        when(repository.save(any(SSOConfig.class))).then(returnsFirstArg());

        service.upsertConfig("google", SSOConfigRequest.builder().clientId("client-id").clientSecret("client-secret").build());

        ArgumentCaptor<SSOConfig> saved = ArgumentCaptor.forClass(SSOConfig.class);
        verify(repository).save(saved.capture());
        String stored = saved.getValue().getClientSecret();
        assertThat(stored).doesNotContain("client-secret");
        assertThat(encryptionService.decrypt(stored, SSO_CONTEXT)).isEqualTo("client-secret");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", SSO_CLIENT_SECRET)))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("upsertConfig (existing): the replaced secret is ciphertext for the pod's tenant and reads back via getConfig")
    void upsertConfig_existing_savesSecretForThePodTenant() {
        givenStoredConfig(encryptionService.encrypt("old-secret", SSO_CONTEXT));
        when(repository.save(any(SSOConfig.class))).then(returnsFirstArg());

        service.upsertConfig("google", SSOConfigRequest.builder().clientId("client-id").clientSecret("new-secret").build());

        ArgumentCaptor<SSOConfig> saved = ArgumentCaptor.forClass(SSOConfig.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getClientSecret()).doesNotContain("new-secret");
        assertThat(encryptionService.decrypt(saved.getValue().getClientSecret(), SSO_CONTEXT)).isEqualTo("new-secret");
        assertThat(service.getConfig("google").getClientSecret()).isEqualTo("new-secret");
    }
}
