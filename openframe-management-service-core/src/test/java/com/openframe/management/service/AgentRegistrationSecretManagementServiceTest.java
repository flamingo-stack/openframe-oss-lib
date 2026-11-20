package com.openframe.management.service;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.data.document.agent.AgentRegistrationSecret;
import com.openframe.data.repository.agent.AgentRegistrationSecretRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.management.service.processor.AgentRegistrationSecretManagementProcessor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.security.GeneralSecurityException;
import java.util.List;
import java.util.Optional;

import static com.openframe.core.crypto.service.SecretPurpose.AGENT_LOG_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.AGENT_REGISTRATION_SECRET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgentRegistrationSecretManagementServiceTest {

    private static final String TENANT = "tenant-1";
    private static final EncryptionContext SECRET_CONTEXT = EncryptionContext.forTenant(TENANT, AGENT_REGISTRATION_SECRET);

    private final EncryptionService encryptionService = tinkEncryption();
    private final AgentRegistrationSecretRepository repository = mock(AgentRegistrationSecretRepository.class);
    private final SecretKeyGenerator secretGenerator = mock(SecretKeyGenerator.class);
    private final AgentRegistrationSecretManagementProcessor processor = mock(AgentRegistrationSecretManagementProcessor.class);
    private final TenantIdProvider tenantIdProvider = mock(TenantIdProvider.class);
    private AgentRegistrationSecretManagementService service;

    private static EncryptionService tinkEncryption() {
        try {
            AeadConfig.register();
            return EncryptionService.withKeyset(KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM), true, null, null);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    @BeforeEach
    void setUp() {
        service = new AgentRegistrationSecretManagementService(repository, secretGenerator, encryptionService, processor,
                tenantIdProvider);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(repository.save(any(AgentRegistrationSecret.class))).then(returnsFirstArg());
    }

    private AgentRegistrationSecret activeSecret(String plainKey) {
        AgentRegistrationSecret secret = new AgentRegistrationSecret();
        secret.setId("old");
        secret.setTenantId(TENANT);
        secret.setSecretKey(encryptionService.encrypt(plainKey, SECRET_CONTEXT));
        secret.setActive(true);
        return secret;
    }

    @Test
    void createInitialSecret_storesCiphertextForThePodTenantAndRegistrationPurpose() {
        when(repository.existsAny()).thenReturn(false);
        when(secretGenerator.generate()).thenReturn("initial-key");

        service.createInitialSecret();

        ArgumentCaptor<AgentRegistrationSecret> saved = ArgumentCaptor.forClass(AgentRegistrationSecret.class);
        verify(repository).save(saved.capture());
        String stored = saved.getValue().getSecretKey();
        assertThat(saved.getValue().isActive()).isTrue();
        assertThat(stored).doesNotContain("initial-key");
        assertThat(encryptionService.decrypt(stored, SECRET_CONTEXT)).isEqualTo("initial-key");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", AGENT_REGISTRATION_SECRET)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant(TENANT, AGENT_LOG_KEY)))
                .isInstanceOf(EncryptionException.class);
        verify(processor).postProcessInitialSecretCreated(saved.getValue(), "initial-key");
    }

    @Test
    void createInitialSecret_skipsWhenOneExists() {
        when(repository.existsAny()).thenReturn(true);

        service.createInitialSecret();

        verify(repository, never()).save(any());
    }

    @Test
    void rotateSecret_deactivatesTheOldSecretAndSavesANewActiveOne() {
        AgentRegistrationSecret old = activeSecret("old-key");
        when(repository.findByActiveTrue()).thenReturn(Optional.of(old));
        when(secretGenerator.generate()).thenReturn("new-key");

        AgentRegistrationSecret rotated = service.rotateSecret();

        ArgumentCaptor<AgentRegistrationSecret> saved = ArgumentCaptor.forClass(AgentRegistrationSecret.class);
        verify(repository, times(2)).save(saved.capture());
        List<AgentRegistrationSecret> all = saved.getAllValues();
        assertThat(all).contains(old);
        assertThat(old.isActive()).isFalse();
        assertThat(rotated).isNotSameAs(old);
        assertThat(rotated.isActive()).isTrue();
        assertThat(all).contains(rotated);
        assertThat(rotated.getCreatedAt()).isNotNull();
    }

    @Test
    void rotateSecret_newSecretIsCiphertextForThePodTenantAndRegistrationPurpose() {
        AgentRegistrationSecret old = activeSecret("old-key");
        String oldCiphertext = old.getSecretKey();
        when(repository.findByActiveTrue()).thenReturn(Optional.of(old));
        when(secretGenerator.generate()).thenReturn("new-key");

        AgentRegistrationSecret rotated = service.rotateSecret();

        String stored = rotated.getSecretKey();
        assertThat(stored).doesNotContain("new-key").isNotEqualTo(oldCiphertext);
        assertThat(encryptionService.decrypt(stored, SECRET_CONTEXT)).isEqualTo("new-key");
        assertThat(encryptionService.decrypt(old.getSecretKey(), SECRET_CONTEXT)).isEqualTo("old-key");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", AGENT_REGISTRATION_SECRET)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant(TENANT, AGENT_LOG_KEY)))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    void rotateSecret_followsTheTenantTheProviderReports() {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-2");
        AgentRegistrationSecret old = activeSecret("old-key");
        when(repository.findByActiveTrue()).thenReturn(Optional.of(old));
        when(secretGenerator.generate()).thenReturn("new-key");

        String stored = service.rotateSecret().getSecretKey();

        assertThat(encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", AGENT_REGISTRATION_SECRET)))
                .isEqualTo("new-key");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, SECRET_CONTEXT)).isInstanceOf(EncryptionException.class);
    }
}
