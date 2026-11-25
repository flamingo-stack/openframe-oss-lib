package com.openframe.client.service.auth;

import com.openframe.client.dto.AgentTokenResponse;
import com.openframe.data.document.oauth.OAuthClient;
import com.openframe.data.repository.oauth.OAuthClientRepository;
import com.nimbusds.jwt.JWTParser;
import com.openframe.security.jwt.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidationException;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.time.Instant;

import static com.openframe.client.service.AgentAuthService.REFRESH_TOKEN_GRANT_TYPE;
import static org.springframework.security.oauth2.core.OAuth2TokenIntrospectionClaimNames.TOKEN_TYPE;

@Component
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenHandler {

    private final JwtService jwtService;
    private final OAuthClientRepository clientRepository;
    private final AccessTokenGenerator accessTokenGenerator;
    private final RefreshTokenGenerator refreshTokenGenerator;
    private final AgentAuthAudit agentAuthAudit;
    private final DeletedMachineTokenGuard deletedMachineTokenGuard;

    public AgentTokenResponse handle(String refreshToken) {
        Jwt jwt = null;
        try {
            jwt = jwtService.decodeToken(refreshToken);
            return refresh(jwt);
        } catch (RuntimeException e) {
            String clientId = jwt == null ? clientIdOfRefused(refreshToken, e) : jwt.getSubject();
            agentAuthAudit.failed(clientId, REFRESH_TOKEN_GRANT_TYPE, e);
            throw e;
        }
    }

    private static String clientIdOfRefused(String refreshToken, RuntimeException failure) {
        if (!(failure instanceof JwtValidationException)) {
            return null;
        }
        try {
            return JWTParser.parse(refreshToken).getJWTClaimsSet().getSubject();
        } catch (ParseException e) {
            log.warn("Client id of a refused refresh token not read", e);
            return null;
        }
    }

    private AgentTokenResponse refresh(Jwt jwt) {
        validateExpiration(jwt);

        Long refreshCount = jwt.getClaim("refresh_count");
        validateRefreshCount(refreshCount);

        String clientId = jwt.getSubject();
        OAuthClient client = clientRepository.findByClientId(clientId)
                .orElseThrow(() -> {
                    log.error("Client not found: {}", clientId);
                    return new IllegalArgumentException("Client not found");
                });
        deletedMachineTokenGuard.requireNotDeleted(client.getMachineId());

        String accessToken = accessTokenGenerator.generate(client, REFRESH_TOKEN_GRANT_TYPE);
        String newRefreshToken = refreshTokenGenerator.generateNext(clientId, refreshCount);
        long accessTokenExpirationSeconds = accessTokenGenerator.getExpirationSeconds();

        return new AgentTokenResponse(
                accessToken,
                newRefreshToken,
                TOKEN_TYPE,
                accessTokenExpirationSeconds
        );
    }

    private void validateExpiration(Jwt jwt) {
        Instant expiresAt = jwt.getExpiresAt();
        if (expiresAt != null && expiresAt.isBefore(Instant.now())) {
            throw new IllegalArgumentException("Refresh token has expired");
        }
    }

    private void validateRefreshCount(long refreshCount) {
        long maxRefreshCount = refreshTokenGenerator.getMaxRefreshCount();
        if (refreshCount >= maxRefreshCount) {
            throw new IllegalArgumentException("Maximum refresh count reached");
        }
    }

}
