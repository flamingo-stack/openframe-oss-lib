package com.openframe.authz.service.auth;

import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.document.oauth.RetiredRefreshToken;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

import static org.springframework.security.oauth2.server.authorization.OAuth2Authorization.Token.INVALIDATED_METADATA_NAME;

@Service
@RequiredArgsConstructor
@Slf4j
public class MongoAuthorizationService implements OAuth2AuthorizationService {
    private final MongoOAuth2AuthorizationRepository repository;
    private final RegisteredClientRepository registeredClientRepository;

    private static final OAuth2TokenType AUTH_CODE = new OAuth2TokenType("code");

    @Value("${openframe.authz.refresh-token-grace-seconds:60}")
    private long refreshTokenGraceSeconds;

    @Override
    public void save(OAuth2Authorization authorization) {
        log.debug("Saving authorization: {}", authorization.getId());

        MongoOAuth2Authorization entity = MongoAuthorizationMapper.toEntity(authorization);
        entity.setRetiredRefreshTokens(retiredTokensAfterSaving(entity));
        repository.save(entity);
    }

    /**
     * Rotation replaces the refresh token, and the client only learns the new one from a response it
     * may never receive: a cancelled request or a dropped connection, while the server still finishes.
     * Keeping the replaced token for a short window lets that client's next refresh recover the session
     * instead of ending it. A list rather than one slot, so a retry that rotates again doesn't kill the
     * token a concurrent request has just received.
     */
    private List<RetiredRefreshToken> retiredTokensAfterSaving(MongoOAuth2Authorization entity) {
        MongoOAuth2Authorization stored = repository.findById(entity.getId()).orElse(null);
        if (stored == null) {
            return null;
        }
        Instant now = Instant.now();
        List<RetiredRefreshToken> retired = new ArrayList<>();
        if (stored.getRetiredRefreshTokens() != null) {
            stored.getRetiredRefreshTokens().stream()
                    .filter(token -> isWithinGrace(token, now))
                    .filter(token -> !token.value().equals(entity.getRefreshTokenValue()))
                    .forEach(retired::add);
        }
        String replaced = stored.getRefreshTokenValue();
        if (replaced != null && !replaced.equals(entity.getRefreshTokenValue())) {
            retired.add(new RetiredRefreshToken(replaced, now));
        }
        return retired.isEmpty() ? null : retired;
    }

    private boolean isWithinGrace(RetiredRefreshToken token, Instant now) {
        return token.retiredAt().plusSeconds(refreshTokenGraceSeconds).isAfter(now);
    }

    @Override
    public void remove(OAuth2Authorization authorization) {
        repository.deleteById(authorization.getId());
    }

    /**
     * Revokes every refresh token issued to the principal, the same way /oauth2/revoke does on logout:
     * the refresh token (and its access token) is marked invalidated, so it can no longer be exchanged.
     * Already revoked or expired tokens are left alone, and a record that fails to revoke is logged and
     * skipped so it can't keep the rest alive; returns how many were revoked.
     * Principal names are the user's email; matched case-insensitively because SSO logins carry the
     * provider's email claim as-is.
     */
    public int revokeAllForPrincipal(String principalName) {
        int revoked = 0;
        for (MongoOAuth2Authorization entity : repository.findAllByPrincipalNameIgnoreCaseAndRefreshTokenValueNotNull(principalName)) {
            if (revoke(entity)) {
                revoked++;
            }
        }
        return revoked;
    }

    private boolean revoke(MongoOAuth2Authorization entity) {
        try {
            OAuth2Authorization authorization = MongoAuthorizationMapper.toDomain(entity, registeredClientRepository);
            if (!authorization.getRefreshToken().isActive()) {
                return false;
            }
            save(invalidate(authorization));
            return true;
        } catch (RuntimeException e) {
            log.error("Failed to revoke authorization {}", entity.getId(), e);
            return false;
        }
    }

    private static OAuth2Authorization invalidate(OAuth2Authorization authorization) {
        OAuth2Authorization.Builder builder = OAuth2Authorization.from(authorization);
        Stream.of(authorization.getRefreshToken(), authorization.getAccessToken())
                .filter(Objects::nonNull)
                .forEach(token -> builder.token(token.getToken(), md -> md.put(INVALIDATED_METADATA_NAME, true)));
        return builder.build();
    }

    @Override
    public OAuth2Authorization findById(String id) {
        return repository.findById(id)
                .map(e -> MongoAuthorizationMapper.toDomain(e, registeredClientRepository))
                .orElse(null);
    }

    @Override
    public OAuth2Authorization findByToken(String token, OAuth2TokenType tokenType) {
        log.debug("Finding authorization by token type: {}", tokenType);

        Optional<MongoOAuth2Authorization> found;
        if (tokenType == null) {
            found = repository.findByAccessTokenValue(token)
                    .or(() -> repository.findByRefreshTokenValue(token))
                    .or(() -> repository.findByAuthorizationCodeValue(token))
                    .or(() -> repository.findByState(token));
            if (found.isEmpty()) {
                return findByRetiredRefreshToken(token);
            }
        } else if (OAuth2TokenType.ACCESS_TOKEN.equals(tokenType)) {
            found = repository.findByAccessTokenValue(token);
        } else if (OAuth2TokenType.REFRESH_TOKEN.equals(tokenType)) {
            found = repository.findByRefreshTokenValue(token);
            if (found.isEmpty()) {
                return findByRetiredRefreshToken(token);
            }
        } else if (AUTH_CODE.equals(tokenType)) {
            found = repository.findByAuthorizationCodeValue(token);
        } else {
            found = Optional.empty();
        }

        return found.map(entity -> MongoAuthorizationMapper.toDomain(entity, registeredClientRepository))
                .orElse(null);
    }

    /**
     * The presented value goes onto the returned authorization because Spring's revocation looks the
     * token up by value on it; the metadata stays the current token's, so a revoked session stays revoked.
     */
    private OAuth2Authorization findByRetiredRefreshToken(String token) {
        Instant now = Instant.now();
        return repository.findByRetiredRefreshTokensValue(token)
                .filter(entity -> entity.getRetiredRefreshTokens().stream()
                        .anyMatch(retired -> retired.value().equals(token) && isWithinGrace(retired, now)))
                .map(entity -> {
                    log.info("Accepted a rotated refresh token within the grace window: authorization {}", entity.getId());
                    OAuth2Authorization authorization = MongoAuthorizationMapper.toDomain(entity, registeredClientRepository);
                    OAuth2Authorization.Token<OAuth2RefreshToken> current = authorization.getRefreshToken();
                    OAuth2RefreshToken presented = new OAuth2RefreshToken(
                            token, current.getToken().getIssuedAt(), current.getToken().getExpiresAt());
                    return OAuth2Authorization.from(authorization)
                            .token(presented, metadata -> metadata.putAll(current.getMetadata()))
                            .build();
                })
                .orElse(null);
    }
}


