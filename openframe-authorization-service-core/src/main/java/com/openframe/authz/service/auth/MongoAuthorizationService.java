package com.openframe.authz.service.auth;

import com.openframe.data.document.oauth.MongoOAuth2Authorization;
import com.openframe.data.repository.oauth.MongoOAuth2AuthorizationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MongoAuthorizationService implements OAuth2AuthorizationService {
    private final MongoOAuth2AuthorizationRepository repository;
    private final RegisteredClientRepository registeredClientRepository;

    private static final OAuth2TokenType AUTH_CODE = new OAuth2TokenType("code");

    @Override
    public void save(OAuth2Authorization authorization) {
        log.debug("Saving authorization: {}", authorization.getId());

        MongoOAuth2Authorization entity = MongoAuthorizationMapper.toEntity(authorization);
        repository.save(entity);
    }

    @Override
    public void remove(OAuth2Authorization authorization) {
        repository.deleteById(authorization.getId());
    }

    /**
     * Revokes every refresh token issued to the principal, the same way /oauth2/revoke does on logout:
     * the refresh token (and its access token) is marked invalidated, so it can no longer be exchanged.
     * Principal names are the user's email; matched case-insensitively because SSO logins carry the
     * provider's email claim as-is.
     */
    public int revokeAllForPrincipal(String principalName) {
        List<MongoOAuth2Authorization> entities =
                repository.findAllByPrincipalNameIgnoreCaseAndRefreshTokenValueNotNull(principalName);
        for (MongoOAuth2Authorization entity : entities) {
            OAuth2Authorization authorization = MongoAuthorizationMapper.toDomain(entity, registeredClientRepository);
            save(invalidate(authorization));
        }
        return entities.size();
    }

    private static OAuth2Authorization invalidate(OAuth2Authorization authorization) {
        OAuth2Authorization.Builder builder = OAuth2Authorization.from(authorization);
        OAuth2Authorization.Token<OAuth2RefreshToken> refresh = authorization.getRefreshToken();
        if (refresh != null) {
            builder.token(refresh.getToken(), md -> md.put(OAuth2Authorization.Token.INVALIDATED_METADATA_NAME, true));
        }
        OAuth2Authorization.Token<OAuth2AccessToken> access = authorization.getAccessToken();
        if (access != null) {
            builder.token(access.getToken(), md -> md.put(OAuth2Authorization.Token.INVALIDATED_METADATA_NAME, true));
        }
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
        } else if (OAuth2TokenType.ACCESS_TOKEN.equals(tokenType)) {
            found = repository.findByAccessTokenValue(token);
        } else if (OAuth2TokenType.REFRESH_TOKEN.equals(tokenType)) {
            found = repository.findByRefreshTokenValue(token);
        } else if (AUTH_CODE.equals(tokenType)) {
            found = repository.findByAuthorizationCodeValue(token);
        } else {
            found = Optional.empty();
        }

        return found.map(entity -> MongoAuthorizationMapper.toDomain(entity, registeredClientRepository))
                .orElse(null);
    }
}


