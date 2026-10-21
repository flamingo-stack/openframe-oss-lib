package com.openframe.api.service;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.AgentLogKeyNotFoundException;
import com.openframe.data.document.agent.AgentLogKey;
import com.openframe.data.repository.agent.AgentLogKeyRepository;
import com.openframe.api.dto.AgentLogKeyResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentLogKeyServiceTest {

    private static final String PLAIN_KEY = "plain-log-key";
    private static final String ENCRYPTED_KEY = "encrypted-log-key";
    private static final Instant CREATED_AT = Instant.parse("2026-10-21T10:00:00Z");

    @Mock private AgentLogKeyRepository logKeyRepository;
    @Mock private EncryptionService encryptionService;

    @InjectMocks private AgentLogKeyService service;

    @Test
    void returnsDecryptedLogKey() {
        AgentLogKey logKey = new AgentLogKey();
        logKey.setEncryptedKey(ENCRYPTED_KEY);
        logKey.setCreatedAt(CREATED_AT);
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.of(logKey));
        when(encryptionService.decrypt(ENCRYPTED_KEY)).thenReturn(PLAIN_KEY);

        AgentLogKeyResponse response = service.getLogKey();

        assertThat(response.getKey()).isEqualTo(PLAIN_KEY);
        assertThat(response.getCreatedAt()).isEqualTo(CREATED_AT);
    }

    @Test
    void throwsWhenLogKeyMissing() {
        when(logKeyRepository.findFirstByOrderByCreatedAtDesc()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getLogKey())
                .isInstanceOf(AgentLogKeyNotFoundException.class);
    }
}
