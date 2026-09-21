package com.openframe.authz.security.grant;

import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2ErrorCodes;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.token.DefaultOAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

import java.security.Principal;
import java.util.Map;

/**
 * Shared minting tail for the custom token-endpoint grants (apple-native, signup-ticket): once a
 * grant has verified its credential and resolved the user, the token generation, authorization
 * persistence and response are identical for every grant — and must stay identical, so refresh
 * and claims behave exactly like the standard grants. Subclasses do only their resolution and
 * call {@link #mintTokens}.
 * <p>
 * Like the concrete providers: never expose a subclass as a Spring bean — an AuthenticationProvider
 * bean becomes the global AuthenticationManager's only provider and breaks password logins.
 */
public abstract class AbstractTokenMintingGrantProvider implements AuthenticationProvider {

    private final OAuth2AuthorizationService authorizationService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;

    protected AbstractTokenMintingGrantProvider(OAuth2AuthorizationService authorizationService,
                                                OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator) {
        this.authorizationService = authorizationService;
        this.tokenGenerator = tokenGenerator;
    }

    protected OAuth2AccessTokenAuthenticationToken mintTokens(RegisteredClient registeredClient,
                                                              OAuth2ClientAuthenticationToken clientPrincipal,
                                                              Authentication userPrincipal,
                                                              AuthorizationGrantType grantType,
                                                              Authentication grant) {
        OAuth2Authorization.Builder authorizationBuilder = OAuth2Authorization.withRegisteredClient(registeredClient)
                .principalName(userPrincipal.getName())
                .authorizationGrantType(grantType)
                .authorizedScopes(registeredClient.getScopes())
                .attribute(Principal.class.getName(), userPrincipal);

        OAuth2AccessToken accessToken = generateAccessToken(registeredClient, userPrincipal, grantType, grant, authorizationBuilder);
        OAuth2RefreshToken refreshToken = maybeGenerateRefreshToken(registeredClient, userPrincipal, grantType, grant, authorizationBuilder);

        authorizationService.save(authorizationBuilder.build());

        return new OAuth2AccessTokenAuthenticationToken(registeredClient, clientPrincipal, accessToken, refreshToken, Map.of());
    }

    private OAuth2AccessToken generateAccessToken(RegisteredClient registeredClient,
                                                  Authentication userPrincipal,
                                                  AuthorizationGrantType grantType,
                                                  Authentication grant,
                                                  OAuth2Authorization.Builder authorizationBuilder) {
        OAuth2Token generated = tokenGenerator.generate(tokenContext(
                registeredClient, userPrincipal, grantType, grant, OAuth2TokenType.ACCESS_TOKEN));
        if (generated == null) {
            throw error(OAuth2ErrorCodes.SERVER_ERROR, "Failed to generate access token.");
        }
        OAuth2AccessToken accessToken = new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER,
                generated.getTokenValue(), generated.getIssuedAt(), generated.getExpiresAt(),
                registeredClient.getScopes());
        if (generated instanceof Jwt jwt) {
            authorizationBuilder.token(accessToken, metadata ->
                    metadata.put(OAuth2Authorization.Token.CLAIMS_METADATA_NAME, jwt.getClaims()));
        } else {
            authorizationBuilder.accessToken(accessToken);
        }
        return accessToken;
    }

    private OAuth2RefreshToken maybeGenerateRefreshToken(RegisteredClient registeredClient,
                                                         Authentication userPrincipal,
                                                         AuthorizationGrantType grantType,
                                                         Authentication grant,
                                                         OAuth2Authorization.Builder authorizationBuilder) {
        if (!registeredClient.getAuthorizationGrantTypes().contains(AuthorizationGrantType.REFRESH_TOKEN)) {
            return null;
        }
        OAuth2Token generated = tokenGenerator.generate(tokenContext(
                registeredClient, userPrincipal, grantType, grant, OAuth2TokenType.REFRESH_TOKEN));
        if (!(generated instanceof OAuth2RefreshToken refreshToken)) {
            return null;
        }
        authorizationBuilder.refreshToken(refreshToken);
        return refreshToken;
    }

    private OAuth2TokenContext tokenContext(RegisteredClient registeredClient,
                                            Authentication userPrincipal,
                                            AuthorizationGrantType grantType,
                                            Authentication grant,
                                            OAuth2TokenType tokenType) {
        return DefaultOAuth2TokenContext.builder()
                .registeredClient(registeredClient)
                .principal(userPrincipal)
                .authorizationServerContext(AuthorizationServerContextHolder.getContext())
                .authorizedScopes(registeredClient.getScopes())
                .tokenType(tokenType)
                .authorizationGrantType(grantType)
                .authorizationGrant(grant)
                .build();
    }

    protected static OAuth2ClientAuthenticationToken authenticatedClient(Authentication authentication) {
        if (authentication.getPrincipal() instanceof OAuth2ClientAuthenticationToken client
                && client.isAuthenticated()) {
            return client;
        }
        throw error(OAuth2ErrorCodes.INVALID_CLIENT, "Client authentication required.");
    }

    protected static OAuth2AuthenticationException error(String code, String description) {
        return new OAuth2AuthenticationException(new OAuth2Error(code, description, null));
    }
}
