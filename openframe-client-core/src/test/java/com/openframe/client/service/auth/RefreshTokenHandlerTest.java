package com.openframe.client.service.auth;

import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
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

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isA;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefreshTokenHandlerTest {

    private static final String TOKEN_OF_MACH_7 =
            new PlainJWT(new JWTClaimsSet.Builder().subject("agent_mach-7").build()).serialize();

    @Mock private JwtService jwtService;
    @Mock private OAuthClientRepository clientRepository;
    @Mock private AccessTokenGenerator accessTokenGenerator;
    @Mock private RefreshTokenGenerator refreshTokenGenerator;
    @Mock private AgentAuthAudit agentAuthAudit;
    @Mock private DeletedMachineTokenGuard deletedMachineTokenGuard;
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
}
