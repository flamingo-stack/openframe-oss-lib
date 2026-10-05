package com.openframe.authz.security.grant;

import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.service.sso.SignupTicketService;
import com.openframe.authz.service.sso.SignupTicketService.SignupTicketPayload;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.sso.apple.AppleAuthorizationCodeClient;
import com.openframe.authz.service.sso.apple.AppleNativeTokenVerifier;
import com.openframe.authz.service.sso.apple.AppleTokenService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
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
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TokenMintingGrantProvidersTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private OAuth2AuthorizationService authorizationService;
    @Mock
    private OAuth2TokenGenerator<OAuth2Token> tokenGenerator;
    @Mock
    private SignupTicketService signupTicketService;
    @Mock
    private UserService userService;
    @Mock
    private AppleNativeTokenVerifier verifier;
    @Mock
    private AppleAuthorizationCodeClient codeClient;
    @Mock
    private AppleTokenService appleTokenService;
    @Mock
    private SsoIdentityService ssoIdentityService;
    @Mock
    private SsoOidcUserService ssoOidcUserService;

    private SignupTicketGrantAuthenticationProvider signupProvider;
    private AppleNativeGrantAuthenticationProvider appleProvider;
    private final AuthUser user = activeUser("user-1", TENANT, "ada@acme.com");

    @BeforeEach
    void setUp() {
        signupProvider = new SignupTicketGrantAuthenticationProvider(signupTicketService, userService, authorizationService, tokenGenerator);
        appleProvider = new AppleNativeGrantAuthenticationProvider(verifier, codeClient, appleTokenService,
                ssoIdentityService, ssoOidcUserService, userService, authorizationService, tokenGenerator);
        TenantContext.setTenantId(TENANT);
        AuthorizationServerContextHolder.setContext(new AuthorizationServerContext() {
            @Override
            public String getIssuer() {
                return "https://auth.example.com/sas/" + TENANT;
            }

            @Override
            public AuthorizationServerSettings getAuthorizationServerSettings() {
                return AuthorizationServerSettings.builder().build();
            }
        });
        lenient().when(tokenGenerator.generate(any())).thenAnswer(inv -> {
            OAuth2TokenContext ctx = inv.getArgument(0);
            Instant now = Instant.now();
            if (OAuth2TokenType.REFRESH_TOKEN.equals(ctx.getTokenType())) {
                return new OAuth2RefreshToken("refresh-1", now, now.plusSeconds(3600));
            }
            return Jwt.withTokenValue("access-1").header("alg", "RS256").claim("sub", ctx.getPrincipal().getName())
                    .issuedAt(now).expiresAt(now.plusSeconds(300)).build();
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        SecurityContextHolder.clearContext();
        AuthorizationServerContextHolder.resetContext();
    }

    private static OAuth2ClientAuthenticationToken client(AuthorizationGrantType... grants) {
        RegisteredClient.Builder builder = RegisteredClient.withId("rc-1").clientId("bff").clientSecret("secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .redirectUri("https://app/cb").scope("openid");
        Consumer<AuthorizationGrantType> add = builder::authorizationGrantType;
        List.of(grants).forEach(add);
        return new OAuth2ClientAuthenticationToken(builder.build(), ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret");
    }

    private static SignupTicketPayload ticket(String userId, String tenantId) {
        return new SignupTicketPayload("ada@acme.com", "Ada", "L", "google", true, "g-1", userId, tenantId);
    }

    private static void assertOAuthError(Runnable call, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(OAuth2AuthenticationException.class,
                e -> assertThat(e.getError().getErrorCode()).isEqualTo(code));
    }

    // --- signup-ticket grant ---

    @Test
    void shouldMintTokensForBoundTicketOfThisTenant() {
        when(signupTicketService.consume("t-1")).thenReturn(Optional.of(ticket("user-1", TENANT)));
        when(userService.findActiveById("user-1")).thenReturn(Optional.of(user));

        OAuth2AccessTokenAuthenticationToken result = (OAuth2AccessTokenAuthenticationToken) signupProvider.authenticate(
                new SignupTicketGrantAuthenticationToken(client(SignupTicketGrantAuthenticationToken.GRANT_TYPE,
                        AuthorizationGrantType.REFRESH_TOKEN), "t-1"));

        assertThat(result.getAccessToken().getTokenValue()).isEqualTo("access-1");
        assertThat(result.getRefreshToken()).isNotNull();
        ArgumentCaptor<OAuth2Authorization> saved = ArgumentCaptor.forClass(OAuth2Authorization.class);
        verify(authorizationService).save(saved.capture());
        assertThat(saved.getValue().getPrincipalName()).isEqualTo("ada@acme.com");
        verify(userService).touchLastLogin("ada@acme.com", TENANT);
    }

    @Test
    void shouldNotIssueRefreshTokenToClientWithoutRefreshGrant() {
        when(signupTicketService.consume("t-1")).thenReturn(Optional.of(ticket("user-1", TENANT)));
        when(userService.findActiveById("user-1")).thenReturn(Optional.of(user));

        OAuth2AccessTokenAuthenticationToken result = (OAuth2AccessTokenAuthenticationToken) signupProvider.authenticate(
                new SignupTicketGrantAuthenticationToken(client(SignupTicketGrantAuthenticationToken.GRANT_TYPE), "t-1"));

        assertThat(result.getRefreshToken()).isNull();
    }

    @Test
    void shouldRejectClientNotRegisteredForSignupTicketGrant() {
        assertOAuthError(() -> signupProvider.authenticate(new SignupTicketGrantAuthenticationToken(
                client(AuthorizationGrantType.AUTHORIZATION_CODE), "t-1")), "unauthorized_client");
        verify(signupTicketService, never()).consume(anyString());
    }

    @Test
    void shouldRejectUnauthenticatedClient() {
        OAuth2ClientAuthenticationToken unauthenticated = new OAuth2ClientAuthenticationToken(
                "bff", ClientAuthenticationMethod.CLIENT_SECRET_BASIC, "secret", Map.of());

        assertOAuthError(() -> signupProvider.authenticate(new SignupTicketGrantAuthenticationToken(unauthenticated, "t")),
                "invalid_client");
    }

    @Test
    void shouldRejectWithoutTenantFromTokenEndpointPath() {
        TenantContext.clear();

        assertOAuthError(() -> signupProvider.authenticate(new SignupTicketGrantAuthenticationToken(
                client(SignupTicketGrantAuthenticationToken.GRANT_TYPE), "t")), "invalid_request");
    }

    @Test
    void shouldRejectUnknownReusedOrUnboundTicket() {
        when(signupTicketService.consume("gone")).thenReturn(Optional.empty());
        when(signupTicketService.consume("unbound")).thenReturn(Optional.of(ticket(null, null)));

        assertOAuthError(() -> signupProvider.authenticate(new SignupTicketGrantAuthenticationToken(
                client(SignupTicketGrantAuthenticationToken.GRANT_TYPE), "gone")), "invalid_grant");
        assertOAuthError(() -> signupProvider.authenticate(new SignupTicketGrantAuthenticationToken(
                client(SignupTicketGrantAuthenticationToken.GRANT_TYPE), "unbound")), "invalid_grant");
    }

    @Test
    void shouldRejectTicketBoundToAnotherTenant() {
        when(signupTicketService.consume("t-1")).thenReturn(Optional.of(ticket("user-1", "other-tenant")));

        assertOAuthError(() -> signupProvider.authenticate(new SignupTicketGrantAuthenticationToken(
                client(SignupTicketGrantAuthenticationToken.GRANT_TYPE), "t-1")), "invalid_grant");
        verify(authorizationService, never()).save(any());
    }

    @Test
    void shouldRejectTicketOfDeactivatedUser() {
        when(signupTicketService.consume("t-1")).thenReturn(Optional.of(ticket("user-1", TENANT)));
        when(userService.findActiveById("user-1")).thenReturn(Optional.empty());

        assertOAuthError(() -> signupProvider.authenticate(new SignupTicketGrantAuthenticationToken(
                client(SignupTicketGrantAuthenticationToken.GRANT_TYPE), "t-1")), "invalid_grant");
    }

    // --- apple-native grant ---

    private AppleNativeGrantAuthenticationToken appleRequest(OAuth2ClientAuthenticationToken client) {
        return new AppleNativeGrantAuthenticationToken(client, "identity-token", "auth-code", "nonce", "Tim", "Cook");
    }

    private Jwt appleIdentity(Map<String, Object> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("identity-token").header("alg", "RS256")
                .subject("apple-sub").audience(List.of("com.openframe.app"));
        claims.forEach(builder::claim);
        return builder.build();
    }

    @Test
    void shouldExchangeVerifiedAppleIdentityForTokens() {
        Jwt identity = appleIdentity(Map.of("email", "a@privaterelay.appleid.com", "email_verified", true));
        when(verifier.verify("identity-token", "nonce")).thenReturn(identity);
        when(codeClient.redeemAndVerify("com.openframe.app", "auth-code", "apple-sub", TENANT)).thenReturn("apple-refresh");
        when(ssoOidcUserService.resolveOrProvision(TENANT, "apple", "a@privaterelay.appleid.com", "Tim", "Cook"))
                .thenReturn(Optional.of(user));

        OAuth2AccessTokenAuthenticationToken result = (OAuth2AccessTokenAuthenticationToken) appleProvider.authenticate(
                appleRequest(client(AppleNativeGrantAuthenticationToken.GRANT_TYPE)));

        assertThat(result.getAccessToken().getTokenValue()).isEqualTo("access-1");
        verify(appleTokenService).store(TENANT, "user-1", "com.openframe.app", "apple-refresh");
        verify(ssoIdentityService).link("apple", identity.getClaims(), user);
        verify(userService).markEmailVerified("user-1");
        ArgumentCaptor<OAuth2Authorization> saved = ArgumentCaptor.forClass(OAuth2Authorization.class);
        verify(authorizationService).save(saved.capture());
        org.springframework.security.core.Authentication principal = saved.getValue().getAttribute(java.security.Principal.class.getName());
        assertThat(principal.getAuthorities()).extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_ADMIN");
    }

    @Test
    void shouldRejectClientNotRegisteredForAppleGrant() {
        assertOAuthError(() -> appleProvider.authenticate(appleRequest(client(AuthorizationGrantType.AUTHORIZATION_CODE))),
                "unauthorized_client");
        verify(verifier, never()).verify(any(), any());
    }

    @Test
    void shouldRejectAppleIdentityWithoutEmail() {
        when(verifier.verify(any(), any())).thenReturn(appleIdentity(Map.of("nonce", "x")));

        assertOAuthError(() -> appleProvider.authenticate(appleRequest(client(AppleNativeGrantAuthenticationToken.GRANT_TYPE))),
                "invalid_grant");
    }

    @Test
    void shouldRejectUnknownAppleUserWhenProvisioningIsOff() {
        when(verifier.verify(any(), any())).thenReturn(appleIdentity(Map.of("email", "a@x.com")));
        when(ssoOidcUserService.resolveOrProvision(any(), any(), any(), any(), any())).thenReturn(Optional.empty());

        assertOAuthError(() -> appleProvider.authenticate(appleRequest(client(AppleNativeGrantAuthenticationToken.GRANT_TYPE))),
                "invalid_grant");
        verify(appleTokenService, never()).store(any(), any(), any(), any());
        verify(authorizationService, never()).save(any());
    }

    // --- converters ---

    @Test
    void shouldConvertOnlyTheirOwnGrantTypeAndRequireParameters() {
        SecurityContextHolder.getContext().setAuthentication(client(AuthorizationGrantType.AUTHORIZATION_CODE));
        MockHttpServletRequest other = new MockHttpServletRequest();
        other.setParameter("grant_type", "authorization_code");
        MockHttpServletRequest appleMissingCode = new MockHttpServletRequest();
        appleMissingCode.setParameter("grant_type", AppleNativeGrantAuthenticationToken.GRANT_TYPE.getValue());
        appleMissingCode.setParameter("identity_token", "t");
        MockHttpServletRequest signupMissingTicket = new MockHttpServletRequest();
        signupMissingTicket.setParameter("grant_type", SignupTicketGrantAuthenticationToken.GRANT_TYPE.getValue());

        assertThat(new AppleNativeGrantAuthenticationConverter().convert(other)).isNull();
        assertThat(new SignupTicketGrantAuthenticationConverter().convert(other)).isNull();
        assertOAuthError(() -> new AppleNativeGrantAuthenticationConverter().convert(appleMissingCode), "invalid_request");
        assertOAuthError(() -> new SignupTicketGrantAuthenticationConverter().convert(signupMissingTicket), "invalid_request");
    }

    @Test
    void shouldConvertAppleParameters() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setParameter("grant_type", AppleNativeGrantAuthenticationToken.GRANT_TYPE.getValue());
        request.setParameter("identity_token", "id");
        request.setParameter("authorization_code", "code");
        request.setParameter("nonce", "n");
        request.setParameter("first_name", "Tim");

        AppleNativeGrantAuthenticationToken token = (AppleNativeGrantAuthenticationToken)
                new AppleNativeGrantAuthenticationConverter().convert(request);

        assertThat(token.getIdentityToken()).isEqualTo("id");
        assertThat(token.getAuthorizationCode()).isEqualTo("code");
        assertThat(token.getNonce()).isEqualTo("n");
        assertThat(token.getFirstName()).isEqualTo("Tim");
        assertThat(token.getLastName()).isNull();
    }
}
