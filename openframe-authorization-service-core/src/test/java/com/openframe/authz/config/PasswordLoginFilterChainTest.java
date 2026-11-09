package com.openframe.authz.config;

import com.openframe.authz.security.AuthSuccessHandler;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.service.auth.AuthErrorDetailStore;
import com.openframe.authz.service.auth.strategy.SsoProviderRegistry;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.authz.service.user.UserService;
import com.openframe.authz.web.AuthErrorResponder;
import com.openframe.core.exception.AuthFlowException;
import com.openframe.data.document.auth.AuthUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.web.SpringJUnitWebConfig;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_BLOCKED;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;

/**
 * The production {@link SecurityConfig#defaultSecurityFilterChain} with the production password-login
 * {@link AuthenticationManager}: guards that the form login is wired to the failure handler that turns
 * a blocked tenant into the error page, not Spring's default "bad credentials" redirect.
 */
@SpringJUnitWebConfig(PasswordLoginFilterChainTest.Wiring.class)
@TestPropertySource(properties = "openframe.auth.error-url=https://app.example/auth/error")
class PasswordLoginFilterChainTest {

    private static final String EMAIL = "owner@example.com";

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private TenantService tenantService;
    @Autowired
    private UserService userService;

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        reset(tenantService, userService);
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    @Test
    @DisplayName("Given a blocked tenant, when its user posts the login form, then the error page shows ACCOUNT_BLOCKED")
    void blockedTenant_redirectsToTheErrorPage() throws Exception {
        doThrow(new AuthFlowException(ACCOUNT_BLOCKED, ACCOUNT_BLOCKED.getMessage())).when(tenantService).refuseLoginUnlessActive(any());

        mvc.perform(post("/login").with(csrf()).param("username", EMAIL).param("password", "right"))
                .andExpect(redirectedUrl("https://app.example/auth/error?ref=ACCOUNT_BLOCKED"));
    }

    @Test
    @DisplayName("Given an active tenant, when the password is wrong, then the login page shows its error")
    void wrongPassword_staysOnTheLoginPage() throws Exception {
        AuthUser user = activeUser("u1", "tenant-a", EMAIL);
        user.setPasswordHash(new BCryptPasswordEncoder().encode("right"));
        when(userService.findActiveByEmailAndTenant(anyString(), any())).thenReturn(Optional.of(user));

        mvc.perform(post("/login").with(csrf()).param("username", EMAIL).param("password", "wrong"))
                .andExpect(redirectedUrl("/login?error"));
    }

    @Configuration
    @EnableWebMvc
    @Import({SecurityConfig.class, AuthErrorResponder.class})
    static class Wiring {

        private final AuthorizationServerConfig authorizationServerConfig = new AuthorizationServerConfig();

        @Bean
        TenantService tenantService() {
            return mock(TenantService.class);
        }

        @Bean
        UserService userService() {
            return mock(UserService.class);
        }

        @Bean
        PasswordEncoder passwordEncoder() {
            return authorizationServerConfig.passwordEncoder();
        }

        @Bean
        UserDetailsService userDetailsService(UserService userService, TenantService tenantService) {
            return authorizationServerConfig.userDetailsService(userService, tenantService);
        }

        @Bean
        AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
            return authorizationServerConfig.authenticationManager(userDetailsService, passwordEncoder);
        }

        @Bean
        AuthErrorDetailStore authErrorDetailStore() {
            return mock(AuthErrorDetailStore.class);
        }

        @Bean
        AuthSuccessHandler authSuccessHandler() {
            return mock(AuthSuccessHandler.class);
        }

        @Bean
        @SuppressWarnings("unchecked")
        OAuth2UserService<OidcUserRequest, OidcUser> oidcUserService() {
            return mock(OAuth2UserService.class);
        }

        @Bean
        ClientRegistrationRepository clientRegistrationRepository() {
            return mock(ClientRegistrationRepository.class);
        }

        @Bean
        SsoCookieCodec ssoCookieCodec() {
            return mock(SsoCookieCodec.class);
        }

        @Bean
        SsoProviderRegistry ssoProviderRegistry() {
            return mock(SsoProviderRegistry.class);
        }
    }
}
