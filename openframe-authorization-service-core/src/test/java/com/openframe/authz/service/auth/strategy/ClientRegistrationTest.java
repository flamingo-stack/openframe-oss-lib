package com.openframe.authz.service.auth.strategy;

import com.openframe.authz.config.DynamicClientRegistrationRepository;
import com.openframe.authz.config.oidc.AppleSSOProperties;
import com.openframe.authz.config.oidc.GoogleSSOProperties;
import com.openframe.authz.config.oidc.MicrosoftSSOProperties;
import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.config.tenant.TenantContextFilter;
import com.openframe.authz.security.ProviderAwareAuthenticationEntryPoint;
import com.openframe.authz.service.auth.DynamicClientRegistrationService;
import com.openframe.authz.service.sso.SSOConfigService;
import com.openframe.data.document.sso.SSOConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ClientRegistrationTest {

    private final SSOConfigService ssoConfigService = mock(SSOConfigService.class);
    private final AppleClientSecretFactory secretFactory = mock(AppleClientSecretFactory.class);
    private MicrosoftClientRegistrationStrategy microsoft;
    private GoogleClientRegistrationStrategy google;
    private AppleClientRegistrationStrategy apple;
    private SsoProviderRegistry registry;

    @BeforeEach
    void setUp() {
        MicrosoftSSOProperties msProps = new MicrosoftSSOProperties();
        msProps.setAuthorizationUrl("https://login.microsoftonline.com/{msTenantId}/oauth2/v2.0/authorize");
        msProps.setTokenUrl("https://login.microsoftonline.com/{msTenantId}/oauth2/v2.0/token");
        msProps.setJwkSetUri("https://login.microsoftonline.com/{msTenantId}/discovery/v2.0/keys");
        msProps.setCommonAuthorizationUrl("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
        msProps.setCommonTokenUrl("https://login.microsoftonline.com/common/oauth2/v2.0/token");
        msProps.setCommonJwkSetUri("https://login.microsoftonline.com/common/discovery/v2.0/keys");
        msProps.setLoginRedirectUri("{baseUrl}/login/oauth2/code/{registrationId}");
        msProps.setScopes(List.of("openid", "email", "profile"));
        GoogleSSOProperties googleProps = new GoogleSSOProperties();
        googleProps.setAuthorizationUrl("https://accounts.google.com/o/oauth2/v2/auth");
        googleProps.setTokenUrl("https://oauth2.googleapis.com/token");
        googleProps.setJwkSetUri("https://www.googleapis.com/oauth2/v3/certs");
        googleProps.setIssuerUri("https://accounts.google.com");
        googleProps.setLoginRedirectUri("{baseUrl}/login/oauth2/code/{registrationId}");
        googleProps.setScopes(List.of("openid", "email"));
        AppleSSOProperties appleProps = new AppleSSOProperties();
        appleProps.setAuthorizationUrl("https://appleid.apple.com/auth/authorize");
        appleProps.setTokenUrl("https://appleid.apple.com/auth/token");
        appleProps.setJwkSetUri("https://appleid.apple.com/auth/keys");
        appleProps.setLoginRedirectUri("{baseUrl}/login/oauth2/code/{registrationId}");
        appleProps.setScopes(List.of("openid", "email", "name"));
        microsoft = new MicrosoftClientRegistrationStrategy(ssoConfigService, msProps);
        google = new GoogleClientRegistrationStrategy(ssoConfigService, googleProps);
        apple = new AppleClientRegistrationStrategy(ssoConfigService, appleProps, secretFactory);
        registry = new SsoProviderRegistry(List.of(microsoft, google, apple));
        when(ssoConfigService.getDecryptedClientSecret(org.mockito.ArgumentMatchers.any())).thenReturn("plain-secret");
    }

    @AfterEach
    void clear() {
        TenantContext.clear();
        RequestContextHolder.resetRequestAttributes();
    }

    private static SSOConfig config(String clientId, String msTenantId) {
        SSOConfig cfg = new SSOConfig();
        cfg.setClientId(clientId);
        cfg.setClientSecret("encrypted");
        cfg.setMsTenantId(msTenantId);
        cfg.setTeamId("TEAM");
        cfg.setKeyId("KEY");
        cfg.setEnabled(true);
        return cfg;
    }

    private static Jwt tokenWithIssuer(String issuer) {
        return Jwt.withTokenValue("t").header("alg", "RS256").claim("iss", issuer).claim("sub", "s").build();
    }

    @Test
    void shouldBuildMicrosoftClientForTenantDirectoryOrCommonEndpoints() {
        when(ssoConfigService.getEffectiveSSOConfig("single", "microsoft")).thenReturn(Optional.of(config("ms-app", "dir-1")));
        when(ssoConfigService.getEffectiveSSOConfig("generic", "microsoft")).thenReturn(Optional.of(config("ms-generic", null)));

        ClientRegistration single = microsoft.buildClient("single");
        ClientRegistration generic = microsoft.buildClient("generic");

        assertThat(single.getProviderDetails().getAuthorizationUri()).contains("/dir-1/");
        assertThat(single.getProviderDetails().getJwkSetUri()).contains("/dir-1/");
        assertThat(single.getClientName()).isEqualTo("Microsoft (single)");
        assertThat(generic.getProviderDetails().getTokenUri()).contains("/common/");
        assertThat(generic.getClientSecret()).isEqualTo("plain-secret");
    }

    @Test
    void shouldRefuseToBuildClientWithoutConfig() {
        when(ssoConfigService.getEffectiveSSOConfig(anyString(), anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> google.buildClient("t")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldPinGoogleIssuerAndUseAppleSpecifics() {
        when(ssoConfigService.getEffectiveSSOConfig("t", "google")).thenReturn(Optional.of(config("g-app", null)));
        when(ssoConfigService.getEffectiveSSOConfig("t", "apple")).thenReturn(Optional.of(config("com.openframe.web", null)));
        when(secretFactory.mint("TEAM", "KEY", "plain-secret", "com.openframe.web")).thenReturn("apple-secret-jwt");

        ClientRegistration googleClient = google.buildClient("t");
        ClientRegistration appleClient = apple.buildClient("t");

        assertThat(googleClient.getProviderDetails().getIssuerUri()).isEqualTo("https://accounts.google.com");
        assertThat(appleClient.getClientSecret()).isEqualTo("apple-secret-jwt");
        assertThat(appleClient.getClientAuthenticationMethod()).isEqualTo(ClientAuthenticationMethod.CLIENT_SECRET_POST);
        assertThat(appleClient.getProviderDetails().getIssuerUri()).isEqualTo("https://appleid.apple.com");
    }

    @Test
    void shouldAcceptOnlyRealMicrosoftDirectoryIssuers() {
        OAuth2TokenValidator<Jwt> validator = registry.idTokenValidator(
                ClientRegistration.withRegistrationId("microsoft").clientId("c")
                        .authorizationGrantType(org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("r").authorizationUri("a").tokenUri("t").build()).orElseThrow();

        assertThat(validator.validate(tokenWithIssuer("https://login.microsoftonline.com/dir-1/v2.0")).hasErrors()).isFalse();
        assertThat(validator.validate(tokenWithIssuer("https://login.microsoftonline.com/dir-1/v2.0/")).hasErrors()).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://login.microsoftonline.com.evil.com/dir/v2.0", "http://login.microsoftonline.com/dir/v2.0",
            "https://login.microsoftonline.com/dir/v1.0", "https://login.microsoftonline.com/a/b/v2.0",
            "https://evil.com/login.microsoftonline.com/dir/v2.0"})
    void shouldRejectLookAlikeMicrosoftIssuers(String issuer) {
        OAuth2TokenValidator<Jwt> validator = microsoft.idTokenValidator(null).orElseThrow();

        assertThat(validator.validate(tokenWithIssuer(issuer)).hasErrors()).isTrue();
    }

    @Test
    void shouldRejectNonAppleIssuerForApple() {
        OAuth2TokenValidator<Jwt> validator = apple.idTokenValidator(null).orElseThrow();

        assertThat(validator.validate(tokenWithIssuer("https://appleid.apple.com")).hasErrors()).isFalse();
        assertThat(validator.validate(tokenWithIssuer("https://appleid.apple.com.evil.com")).hasErrors()).isTrue();
    }

    @Test
    void shouldExposeProviderSupportAndExtraParamsCaseInsensitively() {
        assertThat(registry.isSupported("Google")).isTrue();
        assertThat(registry.isSupported("github")).isFalse();
        assertThat(registry.isSupported(null)).isFalse();
        assertThat(registry.additionalAuthorizationParams("APPLE")).containsEntry("response_mode", "form_post");
        assertThat(registry.additionalAuthorizationParams("google")).isEmpty();
        assertThat(registry.supported()).containsExactlyInAnyOrder("microsoft", "google", "apple");
    }

    @Test
    void shouldResolveClientRegistrationForContextTenantThenSessionTenant() {
        DynamicClientRegistrationService dynamic = mock(DynamicClientRegistrationService.class);
        DynamicClientRegistrationRepository repository = new DynamicClientRegistrationRepository(dynamic);
        ClientRegistration fromContext = ClientRegistration.withRegistrationId("google").clientId("ctx")
                .authorizationGrantType(org.springframework.security.oauth2.core.AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("r").authorizationUri("a").tokenUri("t").build();
        when(dynamic.loadClient("google", "ctx-tenant")).thenReturn(fromContext);
        when(dynamic.loadClient(eq("google"), eq("session-tenant"))).thenReturn(fromContext);
        when(dynamic.loadClient("github", "ctx-tenant")).thenThrow(new IllegalArgumentException("Unsupported"));

        assertThat(repository.findByRegistrationId("google")).isNull();

        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpSession session = new MockHttpSession();
        session.setAttribute(TenantContextFilter.TENANT_ID, "session-tenant");
        request.setSession(session);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        assertThat(repository.findByRegistrationId("google")).isSameAs(fromContext);

        TenantContext.setTenantId("ctx-tenant");
        assertThat(repository.findByRegistrationId("google")).isSameAs(fromContext);
        assertThat(repository.findByRegistrationId("github")).isNull();
    }

    @Test
    void shouldSendUnauthenticatedBrowserToProviderOrLoginAndRememberTenant() throws Exception {
        ProviderAwareAuthenticationEntryPoint entryPoint = new ProviderAwareAuthenticationEntryPoint(registry);
        TenantContext.setTenantId("acme");
        MockHttpServletRequest withProvider = new MockHttpServletRequest();
        withProvider.setContextPath("/sas");
        withProvider.setParameter("provider", "Google");
        MockHttpServletResponse toProvider = new MockHttpServletResponse();
        MockHttpServletRequest unknownProvider = new MockHttpServletRequest();
        unknownProvider.setParameter("provider", "github");
        MockHttpServletResponse toLogin = new MockHttpServletResponse();

        entryPoint.commence(withProvider, toProvider, null);
        entryPoint.commence(unknownProvider, toLogin, null);

        assertThat(toProvider.getRedirectedUrl()).isEqualTo("/sas/oauth2/authorization/google");
        assertThat(withProvider.getSession(false).getAttribute(TenantContextFilter.TENANT_ID)).isEqualTo("acme");
        assertThat(toLogin.getRedirectedUrl()).isEqualTo("/login");
    }
}
