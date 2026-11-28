package com.openframe.core.agentkey;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.AgentLogKeyNotFoundException;
import com.openframe.core.exception.EncryptionException;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.data.document.agent.AgentLogKey;
import com.openframe.data.repository.agent.AgentLogKeyRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.Optional;

import static com.openframe.core.crypto.service.SecretPurpose.AGENT_LOG_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.AGENT_REGISTRATION_SECRET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentLogKeyServiceTest {

    private static final String TENANT = "tenant-1";
    private static final EncryptionContext LOG_KEY_CONTEXT = EncryptionContext.forTenant(TENANT, AGENT_LOG_KEY);
    private static final String PLAIN_KEY = "plain-log-key";
    private static final Instant CREATED_AT = Instant.parse("2026-10-21T10:00:00Z");

    private final EncryptionService encryptionService = tinkEncryption();

    @Mock private AgentLogKeyRepository logKeyRepository;
    @Mock private SecretKeyGenerator keyGenerator;
    @Mock private TenantIdProvider tenantIdProvider;
    @Captor private ArgumentCaptor<AgentLogKey> logKeyCaptor;

    private AgentLogKeyService service;

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
        service = new AgentLogKeyService(logKeyRepository, keyGenerator, encryptionService, tenantIdProvider);
        lenient().when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
    }

    private static AgentLogKey storedKey(String encryptedKey) {
        AgentLogKey logKey = new AgentLogKey();
        logKey.setEncryptedKey(encryptedKey);
        logKey.setCreatedAt(CREATED_AT);
        return logKey;
    }

    @Test
    void returnsDecryptedLogKey() {
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.of(
                storedKey(encryptionService.encrypt(PLAIN_KEY, LOG_KEY_CONTEXT))));

        assertThat(service.current()).isEqualTo(new AgentKeyResponse(PLAIN_KEY, CREATED_AT));
    }

    @Test
    void currentFailsForAKeyEncryptedForAnotherTenant() {
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.of(
                storedKey(encryptionService.encrypt(PLAIN_KEY, EncryptionContext.forTenant("tenant-2", AGENT_LOG_KEY)))));

        assertThatThrownBy(() -> service.current()).isInstanceOf(EncryptionException.class);
    }

    @Test
    void currentFailsForAKeyEncryptedForAnotherPurpose() {
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.of(
                storedKey(encryptionService.encrypt(PLAIN_KEY, EncryptionContext.forTenant(TENANT, AGENT_REGISTRATION_SECRET)))));

        assertThatThrownBy(() -> service.current()).isInstanceOf(EncryptionException.class);
    }

    @Test
    void throwsWhenLogKeyMissing() {
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.current())
                .isInstanceOf(AgentLogKeyNotFoundException.class);
    }

    @Test
    void createsEncryptedLogKeyWhenNoneExists() {
        when(logKeyRepository.existsAny()).thenReturn(false);
        when(keyGenerator.generate()).thenReturn(PLAIN_KEY);
        when(logKeyRepository.save(any(AgentLogKey.class))).then(returnsFirstArg());

        service.createIfMissing();

        verify(logKeyRepository).save(logKeyCaptor.capture());
        AgentLogKey saved = logKeyCaptor.getValue();
        assertThat(saved.getEncryptedKey()).doesNotContain(PLAIN_KEY);
        assertThat(encryptionService.decrypt(saved.getEncryptedKey(), LOG_KEY_CONTEXT)).isEqualTo(PLAIN_KEY);
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void storedKeyIsUnreadableForAnotherTenantOrPurpose() {
        when(logKeyRepository.existsAny()).thenReturn(false);
        when(keyGenerator.generate()).thenReturn(PLAIN_KEY);
        when(logKeyRepository.save(any(AgentLogKey.class))).then(returnsFirstArg());

        service.createIfMissing();

        verify(logKeyRepository).save(logKeyCaptor.capture());
        String stored = logKeyCaptor.getValue().getEncryptedKey();
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", AGENT_LOG_KEY)))
                .isInstanceOf(EncryptionException.class);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, EncryptionContext.forTenant(TENANT, AGENT_REGISTRATION_SECRET)))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    void skipsGenerationWhenLogKeyExists() {
        when(logKeyRepository.existsAny()).thenReturn(true);

        service.createIfMissing();

        verify(logKeyRepository, never()).save(any());
        verifyNoInteractions(keyGenerator);
    }

    @Test
    void rotateSavesANewEncryptedKeyAndReturnsItsPlaintext() {
        when(keyGenerator.generate()).thenReturn(PLAIN_KEY);
        when(logKeyRepository.save(any(AgentLogKey.class))).then(returnsFirstArg());

        AgentKeyResponse rotated = service.rotate();

        verify(logKeyRepository).save(logKeyCaptor.capture());
        AgentLogKey saved = logKeyCaptor.getValue();
        assertThat(saved.getEncryptedKey()).doesNotContain(PLAIN_KEY);
        assertThat(encryptionService.decrypt(saved.getEncryptedKey(), LOG_KEY_CONTEXT)).isEqualTo(PLAIN_KEY);
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(rotated).isEqualTo(new AgentKeyResponse(PLAIN_KEY, saved.getCreatedAt()));
        verify(logKeyRepository, never()).existsAny();
    }

    @Test
    void rotateEncryptsForTheTenantTheProviderReports() {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-2");
        when(keyGenerator.generate()).thenReturn(PLAIN_KEY);
        when(logKeyRepository.save(any(AgentLogKey.class))).then(returnsFirstArg());

        service.rotate();

        verify(logKeyRepository).save(logKeyCaptor.capture());
        String stored = logKeyCaptor.getValue().getEncryptedKey();
        assertThat(encryptionService.decrypt(stored, EncryptionContext.forTenant("tenant-2", AGENT_LOG_KEY))).isEqualTo(PLAIN_KEY);
        assertThatThrownBy(() -> encryptionService.decrypt(stored, LOG_KEY_CONTEXT)).isInstanceOf(EncryptionException.class);
    }
}
