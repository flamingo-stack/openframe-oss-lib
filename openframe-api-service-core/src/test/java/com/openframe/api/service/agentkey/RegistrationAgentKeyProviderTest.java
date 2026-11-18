package com.openframe.api.service.agentkey;

import com.openframe.api.dto.AgentRegistrationSecretResponse;
import com.openframe.api.service.AgentRegistrationSecretService;
import com.openframe.core.agentkey.AgentKeyResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationAgentKeyProviderTest {

    private static final Instant CREATED_AT = Instant.parse("2026-11-16T17:11:50Z");

    @Mock private AgentRegistrationSecretService secretService;
    @InjectMocks private RegistrationAgentKeyProvider provider;

    @Test
    void servesTheRegistrationType() {
        assertThat(provider.type()).isEqualTo(AgentKeyType.REGISTRATION);
    }

    @Test
    void currentIsTheActiveSecret() {
        when(secretService.getActiveSecret()).thenReturn(secret("active-key"));

        assertThat(provider.current()).isEqualTo(new AgentKeyResponse("active-key", CREATED_AT));
    }

    @Test
    void rotateGeneratesANewSecret() {
        when(secretService.generateNewSecret()).thenReturn(secret("new-key"));

        assertThat(provider.rotate()).isEqualTo(new AgentKeyResponse("new-key", CREATED_AT));
    }

    private static AgentRegistrationSecretResponse secret(String key) {
        return AgentRegistrationSecretResponse.builder().id("secret-1").key(key).createdAt(CREATED_AT).active(true).build();
    }
}
