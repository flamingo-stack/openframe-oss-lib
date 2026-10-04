package com.openframe.authz.security.flow;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.security.SessionPrincipalBinder;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoInviteCookiePayload;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.service.user.InvitationRegistrationService;
import com.openframe.core.constants.SsoFlowCookieNames;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;

import static com.openframe.authz.support.ServletTestSupport.bind;
import static com.openframe.authz.support.ServletTestSupport.unbind;
import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static com.openframe.authz.support.SsoTestFixtures.authentication;
import static com.openframe.authz.support.SsoTestFixtures.cookieCodec;
import static com.openframe.authz.support.SsoTestFixtures.inTenMinutes;
import static com.openframe.authz.support.SsoTestFixtures.oidcUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InviteSsoHandlerTest {

    @Mock
    private InvitationRegistrationService invitationRegistrationService;
    @Mock
    private SessionPrincipalBinder sessionPrincipalBinder;

    private final SsoCookieCodec codec = cookieCodec();
    private InviteSsoHandler handler;
    private final MockHttpServletResponse response = new MockHttpServletResponse();
    private final OidcUser invitee = oidcUser(Map.of("email", "new@acme.com", "given_name", "New", "family_name", "Member"));

    @BeforeEach
    void setUp() {
        handler = new InviteSsoHandler(codec, invitationRegistrationService, sessionPrincipalBinder);
    }

    @AfterEach
    void tearDown() {
        unbind();
    }

    private MockHttpServletRequest requestWith(boolean switchTenant, String redirectTo, boolean authMobile) {
        MockHttpServletRequest request = bind(new MockHttpServletRequest("GET", "/login/oauth2/code/google"));
        request.setCookies(new Cookie(SsoFlowCookieNames.OF_SSO_INVITE, codec.encodeInvite(new SsoInviteCookiePayload(
                "invite-state", "inv-1", switchTenant, "google", redirectTo, authMobile, 1L, inTenMinutes()))));
        return request;
    }

    @Test
    void shouldRegisterImmediatelyWhenConsentPageIsNotConfigured() {
        when(invitationRegistrationService.registerByInvitation(any())).thenReturn(activeUser("u", "tenant-9", "new@acme.com"));

        handler.handle(requestWith(true, null, false), response, authentication("google", invitee));

        ArgumentCaptor<InvitationRegistrationRequest> req = ArgumentCaptor.forClass(InvitationRegistrationRequest.class);
        verify(invitationRegistrationService).registerByInvitation(req.capture());
        assertThat(req.getValue().getInvitationId()).isEqualTo("inv-1");
        assertThat(req.getValue().getSwitchTenant()).isTrue();
        assertThat(req.getValue().getFirstName()).isEqualTo("New");
        assertThat(response.getHeader("Location")).isEqualTo("https://auth.example.com/oauth/continue?tenantId=tenant-9");
        verify(invitationRegistrationService, never()).isNewMemberJoin(any());
    }

    @Test
    void shouldRegisterExistingMemberImmediatelyEvenWithConsentPage() {
        ReflectionTestUtils.setField(handler, "joinConfirmUrl", "/auth/sso-join");
        when(invitationRegistrationService.isNewMemberJoin("inv-1")).thenReturn(false);
        when(invitationRegistrationService.registerByInvitation(any())).thenReturn(activeUser("u", "tenant-9", "new@acme.com"));

        handler.handle(requestWith(false, null, false), response, authentication("google", invitee));

        verify(invitationRegistrationService).registerByInvitation(any());
    }

    @Test
    void shouldParkNewMemberOnConsentPageBoundToThisInvitation() {
        ReflectionTestUtils.setField(handler, "joinConfirmUrl", "/auth/sso-join");
        when(invitationRegistrationService.isNewMemberJoin("inv-1")).thenReturn(true);
        MockHttpServletRequest request = requestWith(false, "/x", false);

        handler.handle(request, response, authentication("google", invitee));

        verify(invitationRegistrationService, never()).registerByInvitation(any());
        assertThat(request.getSession(false).getAttribute(SsoRegistrationConstants.SESSION_ATTR_JOIN_INVITE_ID))
                .isEqualTo("inv-1");
        assertThat(response.getRedirectedUrl()).isEqualTo("/auth/sso-join");
        assertThat(response.getCookies()).noneMatch(c -> c.getName().equals(SsoFlowCookieNames.OF_SSO_INVITE));
    }

    @Test
    void shouldCarryMobileContextToConsentPage() {
        ReflectionTestUtils.setField(handler, "joinConfirmUrl", "/auth/sso-join?src=invite");
        when(invitationRegistrationService.isNewMemberJoin("inv-1")).thenReturn(true);

        handler.handle(requestWith(false, "com.openframe.app://auth", true), response, authentication("google", invitee));

        assertThat(response.getRedirectedUrl())
                .isEqualTo("/auth/sso-join?src=invite&authMobile=true&redirectTo=com.openframe.app%3A%2F%2Fauth");
    }
}
