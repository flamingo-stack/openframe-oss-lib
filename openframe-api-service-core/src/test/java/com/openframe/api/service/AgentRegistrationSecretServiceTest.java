package com.openframe.api.service;

import com.openframe.api.dto.AgentRegistrationSecretResponse;
import com.openframe.api.service.processor.AgentRegistrationSecretProcessor;
import com.openframe.api.support.TestEncryption;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.EncryptionException;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.data.document.agent.AgentRegistrationSecret;
import com.openframe.data.repository.agent.AgentRegistrationSecretRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static com.openframe.core.crypto.service.SecretPurpose.AGENT_LOG_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.AGENT_REGISTRATION_SECRET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgentRegistrationSecretServiceTest {

    private static final String TENANT = TestEncryption.TENANT;
    private static final EncryptionContext SECRET_CONTEXT = EncryptionContext.forTenant(TENANT, AGENT_REGISTRATION_SECRET);

    private final EncryptionService encryptionService = TestEncryption.SERVICE;
    private final AgentRegistrationSecretRepository repository = mock(AgentRegistrationSecretRepository.class);
    private final SecretKeyGenerator secretGenerator = mock(SecretKeyGenerator.class);
    private AgentRegistrationSecretService service;

    @BeforeEach
    void setUp() {
        service = new AgentRegistrationSecretService(repository, encryptionService, secretGenerator,
                mock(AgentRegistrationSecretProcessor.class), TestEncryption.tenant(),
                mock(AuditedMethodRunner.class, CALLS_REAL_METHODS));
    }

    private static AgentRegistrationSecret secret(String id, String encryptedKey, boolean active) {
        AgentRegistrationSecret secret = new AgentRegistrationSecret();
        secret.setId(id);
        secret.setTenantId(TENANT);
        secret.setSecretKey(encryptedKey);
        secret.setActive(active);
        return secret;
    }

    @Test
    @DisplayName("getActiveSecret: decrypts the key with the pod's tenant and the registration-secret purpose")
    void getActiveSecret_decryptsWithThePodTenant() {
        when(repository.findByActiveTrue()).thenReturn(Optional.of(
                secret("s-1", encryptionService.encrypt("registration-key", SECRET_CONTEXT), true)));

        assertThat(service.getActiveSecret().getKey()).isEqualTo("registration-key");
    }

    @Test
    @DisplayName("getActiveSecret: a key encrypted for another tenant fails instead of coming back")
    void getActiveSecret_keyOfAnotherTenant_fails() {
        when(repository.findByActiveTrue()).thenReturn(Optional.of(secret("s-1",
                encryptionService.encrypt("registration-key", EncryptionContext.forTenant("tenant-2", AGENT_REGISTRATION_SECRET)),
                true)));

        assertThatThrownBy(() -> service.getActiveSecret()).isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("getAllSecrets: a key encrypted for another purpose fails instead of coming back")
    void getAllSecrets_keyOfAnotherPurpose_fails() {
        when(repository.findAll()).thenReturn(List.of(
                secret("s-1", encryptionService.encrypt("registration-key", SECRET_CONTEXT), false),
                secret("s-2", encryptionService.encrypt("log-key", EncryptionContext.forTenant(TENANT, AGENT_LOG_KEY)), true)));

        assertThatThrownBy(() -> service.getAllSecrets()).isInstanceOf(EncryptionException.class);
    }

    @Test
    @DisplayName("getAllSecrets: every key decrypts with the pod's tenant context")
    void getAllSecrets_decryptsWithThePodTenant() {
        when(repository.findAll()).thenReturn(List.of(
                secret("s-1", encryptionService.encrypt("old-key", SECRET_CONTEXT), false),
                secret("s-2", encryptionService.encrypt("new-key", SECRET_CONTEXT), true)));

        assertThat(service.getAllSecrets()).extracting(AgentRegistrationSecretResponse::getKey)
                .containsExactly("old-key", "new-key");
    }

    @Test
    @DisplayName("generateNewSecret: stores the new key as ciphertext for the pod's tenant, returns it in plain")
    void generateNewSecret_storesCiphertextForThePodTenant() {
        when(repository.findByActiveTrue()).thenReturn(Optional.of(
                secret("s-1", encryptionService.encrypt("old-key", SECRET_CONTEXT), true)));
        when(secretGenerator.generate()).thenReturn("new-key");
        when(repository.save(any(AgentRegistrationSecret.class))).then(invocation -> {
            AgentRegistrationSecret saving = invocation.getArgument(0);
            if (saving.getId() == null) {
                saving.setId("s-2");
            }
            return saving;
        });

        AgentRegistrationSecretResponse response = service.generateNewSecret();

        ArgumentCaptor<AgentRegistrationSecret> saved = ArgumentCaptor.forClass(AgentRegistrationSecret.class);
        verify(repository, atLeastOnce()).save(saved.capture());
        AgentRegistrationSecret newSecret = saved.getAllValues().stream().filter(AgentRegistrationSecret::isActive)
                .findFirst().orElseThrow();
        String stored = newSecret.getSecretKey();
        assertThat(response.getKey()).isEqualTo("new-key");
        assertThat(stored).doesNotContain("new-key");
        assertThat(encryptionService.decrypt(stored, SECRET_CONTEXT)).isEqualTo("new-key");
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", AGENT_REGISTRATION_SECRET)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant(TENANT, AGENT_LOG_KEY)))
                .isInstanceOf(EncryptionException.class);
    }
}
