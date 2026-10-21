package com.openframe.management.service;

import com.openframe.core.crypto.service.EncryptionService;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.AdditionalAnswers.returnsFirstArg;

@ExtendWith(MockitoExtension.class)
class AgentLogKeyManagementServiceTest {

    private static final String PLAIN_KEY = "plain-log-key";
    private static final String ENCRYPTED_KEY = "encrypted-log-key";

    @Mock private AgentLogKeyRepository logKeyRepository;
    @Mock private SecretKeyGenerator keyGenerator;
    @Mock private EncryptionService encryptionService;
    @Captor private ArgumentCaptor<AgentLogKey> logKeyCaptor;

    @InjectMocks private AgentLogKeyManagementService service;

    @Test
    void createsEncryptedLogKeyWhenNoneExists() {
        when(logKeyRepository.existsAny()).thenReturn(false);
        when(keyGenerator.generate()).thenReturn(PLAIN_KEY);
        when(encryptionService.encrypt(PLAIN_KEY)).thenReturn(ENCRYPTED_KEY);
        when(logKeyRepository.save(any(AgentLogKey.class))).then(returnsFirstArg());

        service.createInitialLogKey();

        verify(logKeyRepository).save(logKeyCaptor.capture());
        AgentLogKey saved = logKeyCaptor.getValue();
        assertThat(saved.getEncryptedKey()).isEqualTo(ENCRYPTED_KEY);
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void skipsGenerationWhenLogKeyExists() {
        when(logKeyRepository.existsAny()).thenReturn(true);

        service.createInitialLogKey();

        verify(logKeyRepository, never()).save(any());
        verifyNoInteractions(keyGenerator, encryptionService);
    }
}
