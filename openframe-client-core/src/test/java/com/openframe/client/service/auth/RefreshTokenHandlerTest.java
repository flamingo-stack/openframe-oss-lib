package com.openframe.client.service.auth;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.openframe.client.dto.AgentTokenResponse;
import com.openframe.client.exception.MachineDeletedException;
import com.openframe.client.exception.TenantBlockedException;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.security.jwt.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidationException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static com.openframe.client.service.AgentAuthService.REFRESH_TOKEN_GRANT_TYPE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isA;
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
    private static final String TOKEN_OF_MACH_7 =
            new PlainJWT(new JWTClaimsSet.Builder().subject("agent_mach-7").build()).serialize();

    @Mock private JwtService jwtService;
    @Mock private OAuthClientRepository clientRepository;
    @Mock private AccessTokenGenerator accessTokenGenerator;
    @Mock private RefreshTokenGenerator refreshTokenGenerator;
    @Mock private AgentAuthAudit agentAuthAudit;
    @Mock private MachineTokenGuard machineTokenGuard;
    @InjectMocks private RefreshTokenHandler handler;

    @Test
    void handle_expiredTokenRefusedByTheDecoder_recordsTheFailureForTheClientTheTokenNames() {
        JwtValidationException failure = new JwtValidationException("Jwt expired",
                List.of(new OAuth2Error("invalid_token")));
        when(jwtService.decodeToken(TOKEN_OF_MACH_7)).thenThrow(failure);

        assertThatThrownBy(() -> handler.handle(TOKEN_OF_MACH_7)).isSameAs(failure);

        verify(agentAuthAudit).failed("agent_mach-7", "refresh_token", failure);
    }

    @Test
    void handle_tokenWithABadSignature_recordsTheFailureWithoutAClient() {
        BadJwtException failure = new BadJwtException("Invalid signature");
        when(jwtService.decodeToken(TOKEN_OF_MACH_7)).thenThrow(failure);

        assertThatThrownBy(() -> handler.handle(TOKEN_OF_MACH_7)).isSameAs(failure);

        verify(agentAuthAudit).failed(null, "refresh_token", failure);
    }

    @Test
    void handle_unreadableToken_recordsTheFailureWithoutAClient() {
        BadJwtException failure = new BadJwtException("Malformed token");
        when(jwtService.decodeToken("garbage")).thenThrow(failure);

        assertThatThrownBy(() -> handler.handle("garbage")).isSameAs(failure);

        verify(agentAuthAudit).failed(isNull(), eq("refresh_token"), same(failure));
    }

    @Test
    void handle_expiredToken_recordsTheFailureForTheClientTheTokenNames() {
        Jwt expired = Jwt.withTokenValue("old")
                .header("alg", "RS256")
                .subject("agent_mach-7")
                .issuedAt(Instant.parse("2020-01-01T00:00:00Z"))
                .expiresAt(Instant.parse("2020-01-02T00:00:00Z"))
                .build();
        when(jwtService.decodeToken("old")).thenReturn(expired);

        assertThatThrownBy(() -> handler.handle("old"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Refresh token has expired");

        verify(agentAuthAudit).failed(eq("agent_mach-7"), eq("refresh_token"), isA(IllegalArgumentException.class));
    }

    @Test
    void handle_tokenAllowed_checksTheMachineAndIssuesTokens() {
        // setup
        OAuthClient client = validRefreshTokenOfKnownClient();
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
        validRefreshTokenOfKnownClient();
        TenantBlockedException refusal = new TenantBlockedException("Tenant is blocked");
        doThrow(refusal).when(machineTokenGuard).requireTokenAllowed(MACHINE_ID);

        // execution
        assertThrows(TenantBlockedException.class, () -> handler.handle(REFRESH_TOKEN));

        // verifications
        verifyNoInteractions(accessTokenGenerator);
        verify(refreshTokenGenerator, never()).generateNext(CLIENT_ID, REFRESH_COUNT);
        verify(agentAuthAudit).failed(CLIENT_ID, REFRESH_TOKEN_GRANT_TYPE, refusal);
    }

    @Test
    void handle_machineDeleted_issuesNoToken() {
        // setup
        validRefreshTokenOfKnownClient();
        doThrow(new MachineDeletedException("Machine is deleted")).when(machineTokenGuard).requireTokenAllowed(MACHINE_ID);

        // execution
        assertThrows(MachineDeletedException.class, () -> handler.handle(REFRESH_TOKEN));

        // verifications
        verifyNoInteractions(accessTokenGenerator);
        verify(refreshTokenGenerator, never()).generateNext(CLIENT_ID, REFRESH_COUNT);
    }

    private OAuthClient validRefreshTokenOfKnownClient() {
        Jwt jwt = Jwt.withTokenValue(REFRESH_TOKEN)
                .header("alg", "RS256")
                .subject(CLIENT_ID)
                .claim("refresh_count", REFRESH_COUNT)
                .issuedAt(Instant.now().minusSeconds(60))
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        OAuthClient client = new OAuthClient();
        client.setClientId(CLIENT_ID);
        client.setMachineId(MACHINE_ID);
        when(jwtService.decodeToken(REFRESH_TOKEN)).thenReturn(jwt);
        when(refreshTokenGenerator.getMaxRefreshCount()).thenReturn(10L);
        when(clientRepository.findByClientId(CLIENT_ID)).thenReturn(Optional.of(client));
        return client;
    }
}
