package com.openframe.client.service.auth;

import com.openframe.data.repository.oauth.OAuthClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientCredentialsHandlerTest {

    @Mock private OAuthClientRepository clientRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AccessTokenGenerator accessTokenGenerator;
    @Mock private RefreshTokenGenerator refreshTokenGenerator;
    @Mock private AgentAuthAudit agentAuthAudit;
    @Mock private DeletedMachineTokenGuard deletedMachineTokenGuard;
    @InjectMocks private ClientCredentialsHandler handler;

    @Test
    void handle_unknownClient_recordsTheFailedLoginForTheAskedClient() {
        when(clientRepository.findByClientId("agent_mach-7")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> handler.handle("agent_mach-7", "secret"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Client not found");

        verify(agentAuthAudit).failed(eq("agent_mach-7"), eq("client_credentials"), isA(IllegalArgumentException.class));
    }
}
