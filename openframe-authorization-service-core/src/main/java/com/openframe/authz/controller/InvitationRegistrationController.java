package com.openframe.authz.controller;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.dto.SsoInvitationAcceptRequest;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.service.sso.SsoInvitationService;
import com.openframe.authz.service.sso.SsoTenantRegistrationService;
import com.openframe.authz.service.user.InvitationRegistrationService;
import com.openframe.data.document.auth.AuthUser;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping(path = "/invitations", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class InvitationRegistrationController {

    private final InvitationRegistrationService invitationRegistrationService;
    private final SsoInvitationService ssoInvitationService;

    @PostMapping(path = "/accept", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public AuthUser register(@Valid @RequestBody InvitationRegistrationRequest request) {
        return invitationRegistrationService.registerByInvitation(request);
    }

    @PostMapping(path = "/accept/sso", consumes = MediaType.APPLICATION_JSON_VALUE)
    public void acceptViaSso(@Valid @RequestBody SsoInvitationAcceptRequest request,
                             HttpServletRequest httpRequest,
                             HttpServletResponse httpResponse) throws Exception {
        // start SSO accept flow and set short-lived HMAC cookie
        SsoTenantRegistrationService.SsoAuthorizeData init = ssoInvitationService.startAccept(request);
        Cookie cookie = new Cookie(SsoRegistrationConstants.COOKIE_SSO_INVITE, init.cookieValue());
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(init.cookieTtlSeconds());
        httpResponse.addCookie(cookie);
        // redirect to authorization endpoint (already includes ?tenant=...)
        httpResponse.sendRedirect(httpRequest.getContextPath() + init.redirectPath());
    }
}


