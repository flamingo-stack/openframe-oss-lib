package com.openframe.authz.security.grant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2AccessTokenAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AbstractTokenMintingGrantProviderTest {

    private static final AuthorizationGrantType GRANT_TYPE = SignupTicketGrantAuthenticationToken.GRANT_TYPE;
    private static final Instant ISSUED_AT = Instant.parse("2026-11-11T10:00:00Z");
    private static final Instant EXPIRES_AT = Instant.parse("2026-11-11T10:05:00Z");
    private static final RegisteredClient CLIENT = RegisteredClient.withId("rc-1").clientId("bff")
            .authorizationGrantType(GRANT_TYPE).scope("openid").build();
    private static final RegisteredClient REFRESHING_CLIENT = RegisteredClient.from(CLIENT)
            .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN).build();
    private static final Authentication USER = UsernamePasswordAuthenticationToken.authenticated(
            "ada@acme.com", null, List.of());
    private static final Jwt JWT = Jwt.withTokenValue("jwt-1").header("alg", "RS256").subject("ada@acme.com")
            .issuedAt(ISSUED_AT).expiresAt(EXPIRES_AT).build();
    private static final OAuth2RefreshToken REFRESH_TOKEN = new OAuth2RefreshToken(
            "refresh-1", ISSUED_AT, ISSUED_AT.plusSeconds(3600));

    @Mock
    private OAuth2AuthorizationService authorizationService;
    @Mock
    private OAuth2TokenGenerator<OAuth2Token> tokenGenerator;

    private final AuthorizationServerContext serverContext = new AuthorizationServerContext() {
        @Override
        public String getIssuer() {
            return "https://auth.example.com/sas/tenant-1";
        }

        @Override
        public AuthorizationServerSettings getAuthorizationServerSettings() {
            return AuthorizationServerSettings.builder().build();
        }
    };
    private AbstractTokenMintingGrantProvider provider;

    @BeforeEach
    void setUp() {
        provider = new AbstractTokenMintingGrantProvider(authorizationService, tokenGenerator) {
            @Override
            public Authentication authenticate(Authentication authentication) {
                return null;
            }

            @Override
            public boolean supports(Class<?> authentication) {
                return false;
            }
        };
        AuthorizationServerContextHolder.setContext(serverContext);
    }

    @AfterEach
    void tearDown() {
        AuthorizationServerContextHolder.resetContext();
    }

    @Test
    void mintTokens_accessTokenNotGenerated_failsWithServerError() {
        generates(OAuth2TokenType.ACCESS_TOKEN, null);

        assertThatThrownBy(() -> mint(CLIENT))
                .isInstanceOfSatisfying(OAuth2AuthenticationException.class,
                        e -> assertThat(e.getError().getErrorCode()).isEqualTo("server_error"))
                .hasMessage("Failed to generate access token.");
    }

    @Test
    void mintTokens_jwtAccessToken_storesTheJwtClaimsWithTheToken() {
        generates(OAuth2TokenType.ACCESS_TOKEN, JWT);

        mint(CLIENT);

        assertThat(savedAuthorization().getAccessToken().getClaims()).isEqualTo(JWT.getClaims());
    }

    @Test
    void mintTokens_referenceAccessToken_storesBearerTokenWithClientScopesAndNoClaims() {
        generates(OAuth2TokenType.ACCESS_TOKEN,
                new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER, "reference-1", ISSUED_AT, EXPIRES_AT));

        mint(CLIENT);

        OAuth2Authorization.Token<OAuth2AccessToken> stored = savedAuthorization().getAccessToken();
        assertThat(stored.getClaims()).isNull();
        assertThat(stored.getToken())
                .returns("reference-1", OAuth2AccessToken::getTokenValue)
                .returns(ISSUED_AT, OAuth2AccessToken::getIssuedAt)
                .returns(EXPIRES_AT, OAuth2AccessToken::getExpiresAt)
                .returns(Set.of("openid"), OAuth2AccessToken::getScopes);
    }

    @Test
    void mintTokens_refreshTokenGenerated_storesItWithTheAuthorization() {
        generates(OAuth2TokenType.ACCESS_TOKEN, JWT);
        generates(OAuth2TokenType.REFRESH_TOKEN, REFRESH_TOKEN);

        mint(REFRESHING_CLIENT);

        assertThat(savedAuthorization().getRefreshToken().getToken()).isSameAs(REFRESH_TOKEN);
    }

    @Test
    void mintTokens_refreshTokenNotGenerated_issuesNoRefreshToken() {
        generates(OAuth2TokenType.ACCESS_TOKEN, JWT);
        generates(OAuth2TokenType.REFRESH_TOKEN, null);

        OAuth2AccessTokenAuthenticationToken result = mint(REFRESHING_CLIENT);

        assertThat(result.getRefreshToken()).isNull();
        assertThat(savedAuthorization().getRefreshToken()).isNull();
    }

    @Test
    void mintTokens_accessAndRefreshTokens_contextsCarryTheSavedAuthorization() {
        generates(OAuth2TokenType.ACCESS_TOKEN, JWT);

        mint(REFRESHING_CLIENT);

        String savedId = savedAuthorization().getId();
        assertThat(tokenContexts())
                .extracting(context -> context.getAuthorization().getId())
                .containsExactly(savedId, savedId);
    }

    @Test
    void mintTokens_clientWithRefreshGrant_buildsBothTokenContextsFromTheRequest() {
        generates(OAuth2TokenType.ACCESS_TOKEN, JWT);
        OAuth2ClientAuthenticationToken clientPrincipal = clientPrincipal(REFRESHING_CLIENT);
        SignupTicketGrantAuthenticationToken grant =
                new SignupTicketGrantAuthenticationToken(clientPrincipal, "ticket-1");

        provider.mintTokens(REFRESHING_CLIENT, clientPrincipal, USER, GRANT_TYPE, grant);

        assertThat(tokenContexts())
                .extracting(OAuth2TokenContext::getTokenType, OAuth2TokenContext::getRegisteredClient,
                        OAuth2TokenContext::getPrincipal, OAuth2TokenContext::getAuthorizedScopes,
                        OAuth2TokenContext::getAuthorizationGrantType, OAuth2TokenContext::getAuthorizationGrant,
                        OAuth2TokenContext::getAuthorizationServerContext)
                .containsExactly(
                        tuple(OAuth2TokenType.ACCESS_TOKEN, REFRESHING_CLIENT, USER, Set.of("openid"), GRANT_TYPE,
                                grant, serverContext),
                        tuple(OAuth2TokenType.REFRESH_TOKEN, REFRESHING_CLIENT, USER, Set.of("openid"), GRANT_TYPE,
                                grant, serverContext));
    }

    private void generates(OAuth2TokenType tokenType, OAuth2Token token) {
        doReturn(token).when(tokenGenerator).generate(argThat(context -> tokenType.equals(context.getTokenType())));
    }

    private List<OAuth2TokenContext> tokenContexts() {
        ArgumentCaptor<OAuth2TokenContext> contexts = ArgumentCaptor.forClass(OAuth2TokenContext.class);
        verify(tokenGenerator, times(2)).generate(contexts.capture());
        return contexts.getAllValues();
    }

    private OAuth2AccessTokenAuthenticationToken mint(RegisteredClient registeredClient) {
        OAuth2ClientAuthenticationToken clientPrincipal = clientPrincipal(registeredClient);
        return provider.mintTokens(registeredClient, clientPrincipal, USER, GRANT_TYPE,
                new SignupTicketGrantAuthenticationToken(clientPrincipal, "ticket-1"));
    }

    private static OAuth2ClientAuthenticationToken clientPrincipal(RegisteredClient registeredClient) {
        return new OAuth2ClientAuthenticationToken(registeredClient, ClientAuthenticationMethod.CLIENT_SECRET_BASIC,
                "secret");
    }

    private OAuth2Authorization savedAuthorization() {
        ArgumentCaptor<OAuth2Authorization> saved = ArgumentCaptor.forClass(OAuth2Authorization.class);
        verify(authorizationService).save(saved.capture());
        return saved.getValue();
    }
}
