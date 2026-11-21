package com.openframe.client.service.auth;

import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.openframe.security.jwt.JwtService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenHandlerTest {

    @Mock private JwtService jwtService;
    @Mock private OAuthClientRepository clientRepository;
    @Mock private AccessTokenGenerator accessTokenGenerator;
    @Mock private RefreshTokenGenerator refreshTokenGenerator;
    @Mock private AgentAuthAudit agentAuthAudit;
    @InjectMocks private RefreshTokenHandler handler;

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
}
