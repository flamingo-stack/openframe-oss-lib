package com.openframe.authz.controller;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoInviteCookiePayload;
import com.openframe.authz.security.SsoLoginCookiePayload;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.service.sso.SsoOidcUserService;
import com.openframe.authz.service.tenant.TenantService;
import com.openframe.authz.service.user.InvitationRegistrationService;
import com.openframe.authz.service.validation.InvitationValidator;
import com.openframe.core.constants.SsoFlowCookieNames;
import com.openframe.data.document.auth.AuthInvitation;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.document.user.UserRole;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.cookieCodec;
import static com.openframe.authz.support.SsoTestFixtures.inTenMinutes;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static com.openframe.authz.support.SsoTestFixtures.tenMinutesAgo;
import static com.openframe.authz.support.SsoTestFixtures.tenant;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SsoJoinControllerTest {

    @Mock
    private InvitationValidator invitationValidator;
    @Mock
    private InvitationRegistrationService invitationRegistrationService;
    @Mock
    private SsoOidcUserService ssoOidcUserService;
    @Mock
    private TenantService tenantService;

    private final SsoCookieCodec codec = cookieCodec();
    private SsoJoinController controller;
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    // Apple Hide-My-Email: the session email is a relay address, not the invited corporate email.
    private final OidcUser sessionUser = oidcUser(Map.of(
            "email", "x7k2@privaterelay.appleid.com", "given_name", "Tim", "family_name", "Cook"));
    private final Authentication session = authentication("apple", sessionUser);

    @BeforeEach
    void setUp() {
        controller = new SsoJoinController(codec, invitationValidator, invitationRegistrationService, ssoOidcUserService, tenantService);
        lenient().when(tenantService.findById("tenant-1")).thenReturn(Optional.of(tenant("tenant-1", TenantStatus.ACTIVE)));
    }

    @AfterEach
    void tearDown() {
        unbind();
    }

    private MockHttpServletRequest inviteRequest(String invitationId, long exp, String boundInvitationId) {
        MockHttpServletRequest request = bind(new MockHttpServletRequest("GET", "/oauth/join/pending"));
        request.setCookies(new Cookie(SsoFlowCookieNames.OF_SSO_INVITE, codec.encodeInvite(new SsoInviteCookiePayload(
                "s", invitationId, false, "apple", "/home", false, 1L, exp))));
        if (boundInvitationId != null) {
            request.getSession(true).setAttribute(SsoRegistrationConstants.SESSION_ATTR_JOIN_INVITE_ID, boundInvitationId);
        }
        return request;
    }

    private MockHttpServletRequest loginRequest() {
        MockHttpServletRequest request = bind(new MockHttpServletRequest("GET", "/oauth/join/pending"));
        request.setCookies(new Cookie(SsoFlowCookieNames.OF_SSO_LOGIN, codec.encodeLogin(
                new SsoLoginCookiePayload("s", "google", "com.openframe.app://auth", true, 1L, inTenMinutes()))));
        return request;
    }

    private static AuthInvitation invitation() {
        return AuthInvitation.builder().id("inv-1").tenantId("tenant-1").email("tim@apple-corp.com")
                .roles(List.of(UserRole.ADMIN)).build();
    }

    private static void assertConflict(Runnable call) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    void shouldDescribePendingInvitationBoundToThisSession() {
        when(invitationValidator.loadAndEnsureAcceptable("inv-1")).thenReturn(invitation());

        SsoJoinController.JoinPendingResponse pending = controller.pending(session, inviteRequest("inv-1", inTenMinutes(), "inv-1"));

        assertThat(pending.email()).isEqualTo("x7k2@privaterelay.appleid.com");
        assertThat(pending.firstName()).isEqualTo("Tim");
        assertThat(pending.provider()).isEqualTo("apple");
        assertThat(pending.tenantName()).isEqualTo("Tenant tenant-1");
        assertThat(pending.roles()).containsExactly("ADMIN");
    }

    @Test
    void shouldRejectInviteCookieNotBoundToThisSession() {
        assertConflict(() -> controller.pending(session, inviteRequest("inv-1", inTenMinutes(), "inv-OTHER")));
        assertConflict(() -> controller.pending(session, inviteRequest("inv-1", inTenMinutes(), null)));
        verify(invitationValidator, never()).loadAndEnsureAcceptable(any());
    }

    @Test
    void shouldRejectExpiredCookieOrMissingSessionOrNoFlow() {
        assertConflict(() -> controller.pending(session, inviteRequest("inv-1", tenMinutesAgo(), "inv-1")));
        assertConflict(() -> controller.pending(null, inviteRequest("inv-1", inTenMinutes(), "inv-1")));
        assertConflict(() -> controller.pending(session, bind(new MockHttpServletRequest())));
    }

    @Test
    void shouldDescribePendingSharedDomainLoginAsAdminOfPolicyTenant() {
        when(ssoOidcUserService.autoProvisionTenantForDomain("x7k2@privaterelay.appleid.com")).thenReturn(Optional.of("tenant-1"));

        SsoJoinController.JoinPendingResponse pending = controller.pending(session, loginRequest());

        assertThat(pending.tenantName()).isEqualTo("Tenant tenant-1");
        assertThat(pending.roles()).containsExactly("ADMIN");
        assertThat(pending.provider()).isEqualTo("google");
    }

    @Test
    void shouldConflictWhenDomainIsNoLongerAutoProvisioned() {
        when(ssoOidcUserService.autoProvisionTenantForDomain(any())).thenReturn(Optional.empty());

        assertConflict(() -> controller.pending(session, loginRequest()));
    }

    @Test
    void shouldRequireAcceptedTermsBeforeCreatingAnything() {
        assertThatThrownBy(() -> controller.complete(false, session, inviteRequest("inv-1", inTenMinutes(), "inv-1"), response))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(e.getReason()).isEqualTo("terms_not_accepted");
                });
        verify(invitationRegistrationService, never()).registerByInvitation(any());
    }

    @Test
    void shouldCompleteBoundInvitationAndContinue() throws Exception {
        when(invitationRegistrationService.registerByInvitation(any())).thenReturn(activeUser("u", "tenant-1", "tim@apple-corp.com"));

        controller.complete(true, session, inviteRequest("inv-1", inTenMinutes(), "inv-1"), response);

        ArgumentCaptor<InvitationRegistrationRequest> req = ArgumentCaptor.forClass(InvitationRegistrationRequest.class);
        verify(invitationRegistrationService).registerByInvitation(req.capture());
        assertThat(req.getValue().getInvitationId()).isEqualTo("inv-1");
        assertThat(response.getHeader("Location"))
                .isEqualTo("https://auth.example.com/oauth/continue?tenantId=tenant-1&redirectTo=%2Fhome");
        assertThat(response.getCookies()).anySatisfy(c -> {
            assertThat(c.getName()).isEqualTo(SsoFlowCookieNames.OF_SSO_INVITE);
            assertThat(c.getMaxAge()).isZero();
        });
    }

    @Test
    void shouldNotCompleteInvitationFromAnotherSession() {
        assertConflict(() -> {
            try {
                controller.complete(true, session, inviteRequest("inv-1", inTenMinutes(), "inv-OTHER"), response);
            } catch (java.io.IOException e) {
                throw new RuntimeException(e);
            }
        });
        verify(invitationRegistrationService, never()).registerByInvitation(any());
    }

    @Test
    void shouldCompleteSharedDomainLoginAndKeepMobileContext() throws Exception {
        when(ssoOidcUserService.autoProvisionByGlobalDomain("apple", sessionUser))
                .thenReturn(Optional.of(activeUser("u", "tenant-1", "x7k2@privaterelay.appleid.com")));

        controller.complete(true, session, loginRequest(), response);

        assertThat(response.getHeader("Location")).isEqualTo(
                "https://auth.example.com/oauth/continue?tenantId=tenant-1&redirectTo=com.openframe.app%3A%2F%2Fauth&authMobile=true");
        assertThat(response.getCookies()).anySatisfy(c -> assertThat(c.getName()).isEqualTo(SsoFlowCookieNames.OF_SSO_LOGIN));
    }

    @Test
    void shouldPreferInvitationWhenBothFlowCookiesArePresent() throws Exception {
        MockHttpServletRequest request = inviteRequest("inv-1", inTenMinutes(), "inv-1");
        Cookie invite = request.getCookies()[0];
        request.setCookies(invite, loginRequest().getCookies()[0]);
        when(invitationRegistrationService.registerByInvitation(any())).thenReturn(activeUser("u", "tenant-1", "t@x.com"));

        controller.complete(true, session, request, response);

        verify(ssoOidcUserService, never()).autoProvisionByGlobalDomain(any(), any());
    }
}
