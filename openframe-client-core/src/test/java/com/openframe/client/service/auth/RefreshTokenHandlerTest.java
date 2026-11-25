package com.openframe.client.service.auth;

import com.openframe.client.dto.AgentTokenResponse;
import com.openframe.client.exception.MachineDeletedException;
import com.openframe.client.exception.TenantBlockedException;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.security.jwt.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Optional;

import static com.openframe.client.service.AgentAuthService.REFRESH_TOKEN_GRANT_TYPE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenHandlerTest {

    private static final String REFRESH_TOKEN = "refresh-token";
    private static final String CLIENT_ID = "client-1";
    private static final String MACHINE_ID = "machine-1";
    private static final long REFRESH_COUNT = 1L;

    @Mock private JwtService jwtService;
    @Mock private OAuthClientRepository clientRepository;
    @Mock private AccessTokenGenerator accessTokenGenerator;
    @Mock private RefreshTokenGenerator refreshTokenGenerator;
    @Mock private MachineTokenGuard machineTokenGuard;

    @InjectMocks private RefreshTokenHandler handler;

    private OAuthClient client;

    @BeforeEach
    void setUp() {
        Jwt jwt = Jwt.withTokenValue(REFRESH_TOKEN)
                .header("alg", "RS256")
                .subject(CLIENT_ID)
                .claim("refresh_count", REFRESH_COUNT)
                .issuedAt(Instant.now().minusSeconds(60))
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        client = new OAuthClient();
        client.setClientId(CLIENT_ID);
        client.setMachineId(MACHINE_ID);
        when(jwtService.decodeToken(REFRESH_TOKEN)).thenReturn(jwt);
        when(refreshTokenGenerator.getMaxRefreshCount()).thenReturn(10L);
        when(clientRepository.findByClientId(CLIENT_ID)).thenReturn(Optional.of(client));
    }

    @Test
    void handle_tokenAllowed_checksTheMachineAndIssuesTokens() {
        // setup
        when(accessTokenGenerator.generate(client, REFRESH_TOKEN_GRANT_TYPE)).thenReturn("access");
        when(refreshTokenGenerator.generateNext(CLIENT_ID, REFRESH_COUNT)).thenReturn("next-refresh");

        // execution
        AgentTokenResponse response = handler.handle(REFRESH_TOKEN);

        // verifications
        verify(machineTokenGuard).requireTokenAllowed(MACHINE_ID);
        assertThat(response.getAccessToken()).isEqualTo("access");
        assertThat(response.getRefreshToken()).isEqualTo("next-refresh");
    }

    @Test
    void handle_tenantBlocked_issuesNoToken() {
        // setup
        doThrow(new TenantBlockedException("Tenant is blocked")).when(machineTokenGuard).requireTokenAllowed(MACHINE_ID);

        // execution
        assertThrows(TenantBlockedException.class, () -> handler.handle(REFRESH_TOKEN));

        // verifications
        verifyNoInteractions(accessTokenGenerator);
        verify(refreshTokenGenerator, never()).generateNext(CLIENT_ID, REFRESH_COUNT);
    }

    @Test
    void handle_machineDeleted_issuesNoToken() {
        // setup
        doThrow(new MachineDeletedException("Machine is deleted")).when(machineTokenGuard).requireTokenAllowed(MACHINE_ID);

        // execution
        assertThrows(MachineDeletedException.class, () -> handler.handle(REFRESH_TOKEN));

        // verifications
        verifyNoInteractions(accessTokenGenerator);
        verify(refreshTokenGenerator, never()).generateNext(CLIENT_ID, REFRESH_COUNT);
    }
}
