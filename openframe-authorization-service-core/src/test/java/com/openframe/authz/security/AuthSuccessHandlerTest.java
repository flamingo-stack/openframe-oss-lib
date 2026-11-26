package com.openframe.authz.security;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.authz.config.SecurityConfig;
import com.openframe.authz.config.tenant.TenantContext;
import com.openframe.authz.metrics.PasswordLoginMetrics;
import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.web.RecaptchaSessionCookie;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthSuccessHandlerTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private UserService userService;
    @Mock
    private SsoFlowSuccessHandler ssoFlowSuccessHandler;
    @Mock
    private SsoProviderRegistry registry;
    @Mock
    private PasswordLoginMetrics passwordLoginMetrics;

    private AuthSuccessHandler handler;
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();
    private final Logger logger = (Logger) LoggerFactory.getLogger(AuthSuccessHandler.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

    @BeforeEach
    void setUp() {
        handler = new AuthSuccessHandler(userService, ssoFlowSuccessHandler, registry, passwordLoginMetrics);
        TenantContext.setTenantId(TENANT);
        appender.start();
        logger.addAppender(appender);
        lenient().when(registry.isSupported(anyString())).thenReturn(true);
    }

    @AfterEach
    void clear() {
        TenantContext.clear();
        logger.detachAppender(appender);
    }

    @Test
    void shouldTouchLastLoginAndMarkVerifiedForVerifiedSsoEmail() throws Exception {
        Authentication auth = authentication("google", oidcUser(Map.of("email", "Ada@Acme.com", "email_verified", true)));
        when(userService.findActiveByEmailAndTenant("ada@acme.com", TENANT)).thenReturn(Optional.of(activeUser("u", TENANT, "ada@acme.com")));

        handler.onAuthenticationSuccess(request, response, auth);

        verify(userService).touchLastLogin("Ada@Acme.com", TENANT);
        verify(userService).markEmailVerified("u");
        verify(ssoFlowSuccessHandler).onAuthenticationSuccess(request, response, auth);
    }

    @Test
    void shouldNotMarkVerifiedWhenProviderSaysUnverifiedOrIsUnsupported() throws Exception {
        handler.onAuthenticationSuccess(request, response,
                authentication("google", oidcUser(Map.of("email", "a@acme.com", "email_verified", false))));
        when(registry.isSupported("github")).thenReturn(false);
        handler.onAuthenticationSuccess(request, response, authentication("github", oidcUser(Map.of("email", "a@acme.com"))));

        verify(userService, never()).markEmailVerified(anyString());
    }

    @Test
    void shouldTouchLastLoginForPasswordLoginWithoutMarkingVerified() throws Exception {
        Authentication auth = new UsernamePasswordAuthenticationToken(
                User.withUsername("ada@acme.com").password("x").roles("ADMIN").build(), null, List.of());

        handler.onAuthenticationSuccess(request, response, auth);

        verify(userService).touchLastLogin("ada@acme.com", TENANT);
        verify(userService, never()).markEmailVerified(anyString());
    }

    @Test
    void onAuthenticationSuccess_passwordLoginWithSessionCookie_countedAsPresent() throws Exception {
        // setup
        Authentication auth = passwordAuthentication();
        request.setCookies(new Cookie(RecaptchaSessionCookie.NAME, "token"));

        // execution
        handler.onAuthenticationSuccess(request, response, auth);

        // verifications
        verify(passwordLoginMetrics).recordSucceeded(true);
    }

    @Test
    void onAuthenticationSuccess_passwordLoginWithoutSessionCookie_countedAsAbsent() throws Exception {
        // setup
        Authentication auth = passwordAuthentication();

        // execution
        handler.onAuthenticationSuccess(request, response, auth);

        // verifications
        verify(passwordLoginMetrics).recordSucceeded(false);
    }

    @Test
    void onAuthenticationSuccess_ssoLoginWithSessionCookie_notCounted() throws Exception {
        // setup
        Authentication auth = authentication("google", oidcUser(Map.of("email", "a@acme.com", "email_verified", false)));
        request.setCookies(new Cookie(RecaptchaSessionCookie.NAME, "token"));

        // execution
        handler.onAuthenticationSuccess(request, response, auth);

        // verifications
        verify(passwordLoginMetrics, never()).recordSucceeded(true);
        verify(passwordLoginMetrics, never()).recordSucceeded(false);
    }

    @Test
    void onAuthenticationSuccess_passwordLogin_recordedStateLogged() throws Exception {
        // setup
        Authentication auth = passwordAuthentication();
        when(passwordLoginMetrics.recordSucceeded(false)).thenReturn("absent");

        // execution
        handler.onAuthenticationSuccess(request, response, auth);

        // verifications
        assertThat(appender.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .singleElement()
                .asString()
                .startsWith("Login success")
                .contains("provider=password")
                .endsWith("recaptchaSession=absent");
    }

    @Test
    void onAuthenticationSuccess_ssoLogin_notApplicableLogged() throws Exception {
        // setup
        Authentication auth = authentication("google", oidcUser(Map.of("email", "a@acme.com", "email_verified", false)));

        // execution
        handler.onAuthenticationSuccess(request, response, auth);

        // verifications
        assertThat(appender.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .singleElement()
                .asString()
                .startsWith("Login success")
                .contains("provider=google")
                .endsWith("recaptchaSession=n/a");
    }

    @Test
    void onAuthenticationSuccess_metricsFail_loginStillRecordedAndDelegated() throws Exception {
        // setup
        Authentication auth = passwordAuthentication();
        doThrow(new IllegalStateException("registry")).when(passwordLoginMetrics).recordSucceeded(false);

        // execution
        handler.onAuthenticationSuccess(request, response, auth);

        // verifications
        verify(userService).touchLastLogin("ada@acme.com", TENANT);
        verify(ssoFlowSuccessHandler).onAuthenticationSuccess(request, response, auth);
        assertThat(appender.list)
                .extracting(ILoggingEvent::getFormattedMessage)
                .containsExactly(
                        "Failed to record the reCAPTCHA session state of a password login",
                        "Login success email=ada@acme.com tenantId=tenant-1 provider=password ip=127.0.0.1 ua=null recaptchaSession=unknown");
    }

    @Test
    void shouldAlwaysDelegateEvenWhenSideEffectsFail() throws Exception {
        Authentication auth = authentication("google", oidcUser(Map.of("email", "a@acme.com")));
        doThrow(new IllegalStateException("db")).when(userService).touchLastLogin(anyString(), anyString());

        handler.onAuthenticationSuccess(request, response, auth);

        verify(ssoFlowSuccessHandler).onAuthenticationSuccess(request, response, auth);
    }

    @Test
    void shouldCacheSsoDecodersPerAppNotPerProvider() {
        JwtDecoderFactory<ClientRegistration> factory = new SecurityConfig().ssoJwtDecoderFactory(registry);
        lenient().when(registry.idTokenValidator(any())).thenReturn(Optional.empty());

        JwtDecoder acme = factory.createDecoder(googleApp("acme-client"));
        JwtDecoder acmeAgain = factory.createDecoder(googleApp("acme-client"));
        JwtDecoder globex = factory.createDecoder(googleApp("globex-client"));

        assertThat(acme).isSameAs(acmeAgain);
        assertThat(globex).isNotSameAs(acme);
    }

    private static Authentication passwordAuthentication() {
        return new UsernamePasswordAuthenticationToken(
                User.withUsername("ada@acme.com").password("x").roles("ADMIN").build(), null, List.of());
    }

    private static ClientRegistration googleApp(String clientId) {
        return ClientRegistration.withRegistrationId("google").clientId(clientId).clientSecret("s")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).redirectUri("https://a/cb")
                .authorizationUri("https://accounts.google.com/a").tokenUri("https://oauth2.googleapis.com/token")
                .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs").issuerUri("https://accounts.google.com").build();
    }
}
