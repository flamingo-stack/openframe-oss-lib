package com.openframe.core.agentkey;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.AgentLogKeyNotFoundException;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.data.document.agent.AgentLogKey;
import com.openframe.data.repository.agent.AgentLogKeyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentLogKeyServiceTest {

    private static final String PLAIN_KEY = "plain-log-key";
    private static final String ENCRYPTED_KEY = "encrypted-log-key";
    private static final Instant CREATED_AT = Instant.parse("2026-10-21T10:00:00Z");

    @Mock private AgentLogKeyRepository logKeyRepository;
    @Mock private SecretKeyGenerator keyGenerator;
    @Mock private EncryptionService encryptionService;
    @Captor private ArgumentCaptor<AgentLogKey> logKeyCaptor;

    @InjectMocks private AgentLogKeyService service;

    @Test
    void returnsDecryptedLogKey() {
        AgentLogKey logKey = new AgentLogKey();
        logKey.setEncryptedKey(ENCRYPTED_KEY);
        logKey.setCreatedAt(CREATED_AT);
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.of(logKey));
        when(encryptionService.decrypt(ENCRYPTED_KEY)).thenReturn(PLAIN_KEY);

        assertThat(service.getLogKey()).isEqualTo(new AgentLogKeyResponse(PLAIN_KEY, CREATED_AT));
    }

    @Test
    void throwsWhenLogKeyMissing() {
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getLogKey())
                .isInstanceOf(AgentLogKeyNotFoundException.class);
    }

    @Test
    void createsEncryptedLogKeyWhenNoneExists() {
        when(logKeyRepository.existsAny()).thenReturn(false);
        when(keyGenerator.generate()).thenReturn(PLAIN_KEY);
        when(encryptionService.encrypt(PLAIN_KEY)).thenReturn(ENCRYPTED_KEY);
        when(logKeyRepository.save(any(AgentLogKey.class))).then(returnsFirstArg());

        service.createIfMissing();

        verify(logKeyRepository).save(logKeyCaptor.capture());
        AgentLogKey saved = logKeyCaptor.getValue();
        assertThat(saved.getEncryptedKey()).isEqualTo(ENCRYPTED_KEY);
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void skipsGenerationWhenLogKeyExists() {
        when(logKeyRepository.existsAny()).thenReturn(true);

        service.createIfMissing();

        verify(logKeyRepository, never()).save(any());
        verifyNoInteractions(keyGenerator, encryptionService);
    }
}
