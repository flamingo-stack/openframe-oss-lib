package com.openframe.authz.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static org.assertj.core.api.Assertions.assertThat;

class SessionPrincipalBinderTest {

    private static final SimpleGrantedAuthority ROLE = new SimpleGrantedAuthority("ROLE_USER");

    private final SessionPrincipalBinder binder = new SessionPrincipalBinder();
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static OidcUser idpUser(String email, OidcUserInfo userInfo) {
        Instant now = Instant.now();
        OidcIdToken idToken = new OidcIdToken("id-token-value", now, now.plusSeconds(300),
                Map.of("sub", "subject-1", "email", email));
        return new DefaultOidcUser(List.of(ROLE), idToken, userInfo, "email");
    }

    private Object savedContext() {
        return request.getSession(false) == null ? null : request.getSession(false)
                .getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
    }

    @Test
    void shouldMakeTheAccountEmailThePrincipalNameAndSaveItToTheSession() {
        OAuth2AuthenticationToken idpToken = new OAuth2AuthenticationToken(
                idpUser("idp@acme.com", null), List.of(ROLE), "google");
        idpToken.setDetails("web-details");

        binder.bind(idpToken, activeUser("u", "t", "invited@acme.com"), request, response);

        Authentication bound = SecurityContextHolder.getContext().getAuthentication();
        assertThat(bound.getName()).isEqualTo("invited@acme.com");
        assertThat(bound.getDetails()).isEqualTo("web-details");
        assertThat(bound.getAuthorities().stream().map(GrantedAuthority::getAuthority)).containsExactly("ROLE_USER");
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) bound;
        assertThat(token.getAuthorizedClientRegistrationId()).isEqualTo("google");
        assertThat(((OidcUser) token.getPrincipal()).getIdToken().getTokenValue()).isEqualTo("id-token-value");
        assertThat(savedContext()).isInstanceOfSatisfying(SecurityContext.class,
                saved -> assertThat(saved.getAuthentication()).isSameAs(bound));
    }

    @Test
    void shouldKeepTheIdpUserInfoClaims() {
        OidcUserInfo userInfo = new OidcUserInfo(Map.of("sub", "subject-1", "given_name", "Ada"));
        OAuth2AuthenticationToken idpToken = new OAuth2AuthenticationToken(
                idpUser("idp@acme.com", userInfo), List.of(ROLE), "apple");

        binder.bind(idpToken, activeUser("u", "t", "invited@acme.com"), request, response);

        OidcUser bound = (OidcUser) ((OAuth2AuthenticationToken) SecurityContextHolder.getContext().getAuthentication())
                .getPrincipal();
        assertThat(bound.getUserInfo().getClaimAsString("given_name")).isEqualTo("Ada");
    }

    @Test
    void shouldLeaveTheSessionAloneWhenTheAccountIsAlreadyThePrincipal() {
        OAuth2AuthenticationToken idpToken = new OAuth2AuthenticationToken(
                idpUser("Ada@Acme.com", null), List.of(ROLE), "google");

        binder.bind(idpToken, activeUser("u", "t", "ada@acme.com"), request, response);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(savedContext()).isNull();
    }

    @Test
    void shouldIgnoreAuthenticationsThatAreNotOidc() {
        Authentication notOAuth = new TestingAuthenticationToken("someone", "secret");
        Authentication notOidc = new OAuth2AuthenticationToken(
                new DefaultOAuth2User(List.of(ROLE), Map.of("email", "idp@acme.com"), "email"), List.of(ROLE), "github");

        binder.bind(notOAuth, activeUser("u", "t", "invited@acme.com"), request, response);
        binder.bind(notOidc, activeUser("u", "t", "invited@acme.com"), request, response);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(savedContext()).isNull();
    }

    @Test
    void shouldReportTheBoundAccountOnlyAfterBinding() {
        OAuth2AuthenticationToken idpToken = new OAuth2AuthenticationToken(
                idpUser("idp@acme.com", null), List.of(ROLE), "google");

        assertThat(SessionPrincipalBinder.boundAccountEmail(idpToken)).isEmpty();
        assertThat(SessionPrincipalBinder.boundAccountEmail(null)).isEmpty();
        assertThat(SessionPrincipalBinder.boundAccountEmail(new TestingAuthenticationToken("someone", "secret"))).isEmpty();

        binder.bind(idpToken, activeUser("u", "t", "invited@acme.com"), request, response);

        assertThat(SessionPrincipalBinder.boundAccountEmail(SecurityContextHolder.getContext().getAuthentication()))
                .contains("invited@acme.com");
    }
}
