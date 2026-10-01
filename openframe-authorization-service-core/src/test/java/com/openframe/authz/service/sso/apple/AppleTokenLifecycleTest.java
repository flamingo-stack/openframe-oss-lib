package com.openframe.authz.service.sso.apple;

import com.nimbusds.jwt.SignedJWT;
import com.openframe.authz.config.oidc.AppleSSOProperties;
import com.openframe.authz.service.auth.strategy.AppleClientSecretFactory;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.auth.AppleUserToken;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.AppleUserTokenRepository;
import com.openframe.data.repository.auth.AuthUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.security.KeyPair;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static com.openframe.authz.support.TestTokens.ecKeyPair;
import static com.openframe.authz.support.TestTokens.pkcs8Pem;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class AppleTokenLifecycleTest {

    private static final String REVOKE_URL = "https://appleid.apple.com/auth/revoke";

    private final AppleUserTokenRepository tokenRepository = mock(AppleUserTokenRepository.class);
    private final EncryptionService encryption = new EncryptionService("0123456789abcdef0123456789abcdef", "0123456789abcdef");
    private final SSOConfigService ssoConfigService = mock(SSOConfigService.class);
    private final AppleClientSecretFactory secretFactory = mock(AppleClientSecretFactory.class);
    private MockRestServiceServer apple;
    private AppleTokenService tokenService;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        apple = MockRestServiceServer.bindTo(builder).build();
        tokenService = new AppleTokenService(tokenRepository, encryption, ssoConfigService, secretFactory,
                new AppleSSOProperties(), builder);
    }

    private AppleUserToken storedToken() {
        return AppleUserToken.builder().id("doc").tenantId("t").userId("u-1").clientId("com.openframe.app")
                .refreshToken(encryption.encryptClientSecret("apple-refresh")).build();
    }

    private void appleConfigured() {
        SSOConfig cfg = new SSOConfig();
        cfg.setTeamId("TEAM");
        cfg.setKeyId("KEY");
        when(ssoConfigService.getEffectiveSSOConfig("t", "apple")).thenReturn(Optional.of(cfg));
        when(ssoConfigService.getDecryptedClientSecret(cfg)).thenReturn("pem");
        when(secretFactory.mint("TEAM", "KEY", "pem", "com.openframe.app")).thenReturn("secret-jwt");
    }

    @Test
    void shouldStoreRefreshTokenEncryptedAndIgnoreBlank() {
        when(tokenRepository.findByUserId("u-1")).thenReturn(Optional.empty());

        tokenService.store("t", "u-1", "com.openframe.app", "apple-refresh");
        tokenService.store("t", "u-1", "com.openframe.app", " ");

        verify(tokenRepository).save(org.mockito.ArgumentMatchers.argThat(doc ->
                !doc.getRefreshToken().equals("apple-refresh")
                        && encryption.decryptClientSecret(doc.getRefreshToken()).equals("apple-refresh")
                        && doc.getUserId().equals("u-1")));
    }

    @Test
    void shouldNeverFailSignInWhenStoringFails() {
        when(tokenRepository.findByUserId("u-1")).thenThrow(new IllegalStateException("db"));

        assertThatCode(() -> tokenService.store("t", "u-1", "c", "r")).doesNotThrowAnyException();
    }

    @Test
    void shouldRevokeAtAppleThenForget() {
        appleConfigured();
        AppleUserToken token = storedToken();
        apple.expect(requestTo(REVOKE_URL))
                .andExpect(content().formDataContains(Map.of("client_id", "com.openframe.app", "client_secret", "secret-jwt",
                        "token", "apple-refresh", "token_type_hint", "refresh_token")))
                .andRespond(withSuccess());

        assertThat(tokenService.revokeAndForget(token)).isTrue();
        verify(tokenRepository).delete(token);
        apple.verify();
    }

    @Test
    void shouldKeepTokenForRetryWhenAppleFails() {
        appleConfigured();
        AppleUserToken token = storedToken();
        apple.expect(requestTo(REVOKE_URL)).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThat(tokenService.revokeAndForget(token)).isFalse();
        verify(tokenRepository, never()).delete(any());
    }

    @Test
    void shouldForgetTokenWithoutRevocationWhenAppleIsNotConfigured() {
        // Pinned: with no key material the token is dropped rather than retried forever.
        when(ssoConfigService.getEffectiveSSOConfig("t", "apple")).thenReturn(Optional.empty());
        AppleUserToken token = storedToken();

        assertThat(tokenService.revokeAndForget(token)).isTrue();
        verify(tokenRepository).delete(token);
    }

    @Test
    void shouldSweepOnlyTokensOfDeletedOrMissingUsers() {
        AppleTokenService service = mock(AppleTokenService.class);
        AuthUserRepository users = mock(AuthUserRepository.class);
        AppleUserToken ofActive = AppleUserToken.builder().userId("active").build();
        AppleUserToken ofDeleted = AppleUserToken.builder().userId("deleted").build();
        AppleUserToken ofMissing = AppleUserToken.builder().userId("missing").build();
        AuthUser deleted = activeUser("deleted", "t", "d@x.com");
        deleted.setStatus(UserStatus.DELETED);
        when(tokenRepository.findAll()).thenReturn(List.of(ofActive, ofDeleted, ofMissing));
        when(users.findById("active")).thenReturn(Optional.of(activeUser("active", "t", "a@x.com")));
        when(users.findById("deleted")).thenReturn(Optional.of(deleted));
        when(users.findById("missing")).thenReturn(Optional.empty());

        new AppleTokenRevocationScheduler(tokenRepository, users, service).revokeTokensOfDeletedUsers();

        verify(service).revokeAndForget(ofDeleted);
        verify(service).revokeAndForget(ofMissing);
        verify(service, never()).revokeAndForget(ofActive);
    }

    @Test
    void shouldCaptureWebRefreshTokenOnlyForAppleWithActiveUser() {
        OAuth2AuthorizedClientRepository clients = mock(OAuth2AuthorizedClientRepository.class);
        UserService userService = mock(UserService.class);
        AppleTokenService service = mock(AppleTokenService.class);
        AppleWebTokenCapture capture = new AppleWebTokenCapture(clients, userService, service);
        var appleAuth = authentication("apple", oidcUser(Map.of("email", "A@privaterelay.appleid.com")));
        ClientRegistration registration = ClientRegistration.withRegistrationId("apple").clientId("com.openframe.web")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).redirectUri("https://a/cb")
                .authorizationUri("https://idp/a").tokenUri("https://idp/t").build();
        OAuth2AuthorizedClient authorized = new OAuth2AuthorizedClient(registration, "p",
                new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER, "at", Instant.now(), Instant.now().plusSeconds(60)),
                new OAuth2RefreshToken("apple-refresh", Instant.now()));
        MockHttpServletRequest request = new MockHttpServletRequest();
        when(clients.loadAuthorizedClient(eq("apple"), any(), any())).thenReturn(authorized);
        when(userService.findActiveByEmail("a@privaterelay.appleid.com")).thenReturn(Optional.of(activeUser("u-1", "t", "a@x.com")));

        capture.captureIfApple(request, appleAuth);
        capture.captureIfApple(request, authentication("google", oidcUser(Map.of("email", "a@x.com"))));

        verify(service).store("t", "u-1", "com.openframe.web", "apple-refresh");
        verify(clients, never()).loadAuthorizedClient(eq("google"), any(), any());
    }

    @Test
    void shouldMintEs256ClientSecretForApple() throws Exception {
        KeyPair keys = ecKeyPair();
        String pemWithEscapedNewlines = pkcs8Pem(keys).replace("\n", "\\n");

        String secret = new AppleClientSecretFactory().mint("TEAM", "KEY", pemWithEscapedNewlines, "com.openframe.app");

        SignedJWT jwt = SignedJWT.parse(secret);
        assertThat(jwt.getHeader().getAlgorithm().getName()).isEqualTo("ES256");
        assertThat(jwt.getHeader().getKeyID()).isEqualTo("KEY");
        assertThat(jwt.getJWTClaimsSet().getIssuer()).isEqualTo("TEAM");
        assertThat(jwt.getJWTClaimsSet().getSubject()).isEqualTo("com.openframe.app");
        assertThat(jwt.getJWTClaimsSet().getAudience()).containsExactly("https://appleid.apple.com");
        assertThat(jwt.getJWTClaimsSet().getExpirationTime().toInstant()).isBefore(Instant.now().plusSeconds(301));
        assertThat(jwt.verify(new com.nimbusds.jose.crypto.ECDSAVerifier((java.security.interfaces.ECPublicKey) keys.getPublic())))
                .isTrue();
    }

    @Test
    void shouldRequireTeamAndKeyIdForClientSecret() {
        assertThatThrownBy(() -> new AppleClientSecretFactory().mint(" ", "KEY", "pem", "c"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AppleClientSecretFactory().mint("TEAM", null, "pem", "c"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new AppleClientSecretFactory().mint("TEAM", "KEY", "not a pem", "c"))
                .isInstanceOf(IllegalStateException.class);
    }
}
