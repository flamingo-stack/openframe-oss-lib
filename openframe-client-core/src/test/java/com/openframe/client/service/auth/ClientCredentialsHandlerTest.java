package com.openframe.client.service.auth;

import com.openframe.client.dto.AgentTokenResponse;
import com.openframe.client.exception.MachineDeletedException;
import com.openframe.client.exception.TenantBlockedException;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static com.openframe.client.service.AgentAuthService.CLIENT_CREDENTIALS_GRANT_TYPE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientCredentialsHandlerTest {

    private static final String CLIENT_ID = "client-1";
    private static final String SECRET = "secret";
    private static final String SECRET_HASH = "secret-hash";
    private static final String MACHINE_ID = "machine-1";

    @Mock private OAuthClientRepository clientRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AccessTokenGenerator accessTokenGenerator;
    @Mock private RefreshTokenGenerator refreshTokenGenerator;
    @Mock private AgentAuthAudit agentAuthAudit;
    @Mock private MachineTokenGuard machineTokenGuard;
    @InjectMocks private ClientCredentialsHandler handler;

    @Test
    void handle_unknownClient_recordsTheFailedLoginForTheAskedClient() {
        when(clientRepository.findByClientId("agent_mach-7")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> handler.handle("agent_mach-7", "secret"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Client not found");

        verify(agentAuthAudit).failed(eq("agent_mach-7"), eq("client_credentials"), isA(IllegalArgumentException.class));
    }

    @Test
    void handle_tokenAllowed_checksTheMachineAndIssuesTokens() {
        // setup
        OAuthClient client = knownClient();
        when(accessTokenGenerator.generate(client, CLIENT_CREDENTIALS_GRANT_TYPE)).thenReturn("access");
        when(refreshTokenGenerator.generate(CLIENT_ID)).thenReturn("refresh");

        // execution
        AgentTokenResponse response = handler.handle(CLIENT_ID, SECRET);

        // verifications
        verify(machineTokenGuard).requireTokenAllowed(MACHINE_ID);
        assertThat(response.getAccessToken()).isEqualTo("access");
        assertThat(response.getRefreshToken()).isEqualTo("refresh");
    }

    @Test
    void handle_tenantBlocked_issuesNoToken() {
        // setup
        knownClient();
        TenantBlockedException refusal = new TenantBlockedException("Tenant is blocked");
        doThrow(refusal).when(machineTokenGuard).requireTokenAllowed(MACHINE_ID);

        // execution
        assertThrows(TenantBlockedException.class, () -> handler.handle(CLIENT_ID, SECRET));

        // verifications
        verifyNoInteractions(accessTokenGenerator, refreshTokenGenerator);
        verify(agentAuthAudit).failed(CLIENT_ID, CLIENT_CREDENTIALS_GRANT_TYPE, refusal);
    }

    @Test
    void handle_machineDeleted_issuesNoToken() {
        // setup
        knownClient();
        doThrow(new MachineDeletedException("Machine is deleted")).when(machineTokenGuard).requireTokenAllowed(MACHINE_ID);

        // execution
        assertThrows(MachineDeletedException.class, () -> handler.handle(CLIENT_ID, SECRET));

        // verifications
        verifyNoInteractions(accessTokenGenerator, refreshTokenGenerator);
    }

    private OAuthClient knownClient() {
        OAuthClient client = new OAuthClient();
        client.setClientId(CLIENT_ID);
        client.setClientSecret(SECRET_HASH);
        client.setMachineId(MACHINE_ID);
        when(clientRepository.findByClientId(CLIENT_ID)).thenReturn(Optional.of(client));
        when(passwordEncoder.matches(SECRET, SECRET_HASH)).thenReturn(true);
        return client;
    }
}
