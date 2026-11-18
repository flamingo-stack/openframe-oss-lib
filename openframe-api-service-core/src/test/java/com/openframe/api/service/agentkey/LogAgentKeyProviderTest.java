package com.openframe.api.service.agentkey;

import com.openframe.core.agentkey.AgentKeyResponse;
import com.openframe.core.agentkey.AgentLogKeyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LogAgentKeyProviderTest {

    private static final AgentKeyResponse KEY = new AgentKeyResponse("log-key", Instant.parse("2026-11-16T17:15:30Z"));

    @Mock private AgentLogKeyService logKeyService;
    @InjectMocks private LogAgentKeyProvider provider;

    @Test
    void servesTheLogType() {
        assertThat(provider.type()).isEqualTo(AgentKeyType.LOG);
    }

    @Test
    void currentIsTheNewestLogKey() {
        when(logKeyService.current()).thenReturn(KEY);

        assertThat(provider.current()).isEqualTo(KEY);
    }

    @Test
    void rotateAddsANewLogKey() {
        when(logKeyService.rotate()).thenReturn(KEY);

        assertThat(provider.rotate()).isEqualTo(KEY);
    }
}
