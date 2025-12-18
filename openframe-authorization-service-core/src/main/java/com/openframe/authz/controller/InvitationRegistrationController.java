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

import static com.openframe.authz.web.AuthStateUtils.clearAuthState;
import static com.openframe.authz.web.Redirects.seeOther;
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

    @GetMapping(path = "/accept/sso")
    public void acceptViaSso(@Valid @ModelAttribute SsoInvitationAcceptRequest request,
                             HttpServletRequest httpRequest,
                             HttpServletResponse httpResponse) throws Exception {
        clearAuthState(httpRequest, httpResponse);
        // start SSO accept flow and set short-lived HMAC cookie
        SsoTenantRegistrationService.SsoAuthorizeData init = ssoInvitationService.startAccept(request);
        Cookie cookie = new Cookie(SsoRegistrationConstants.COOKIE_SSO_INVITE, init.cookieValue());
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(init.cookieTtlSeconds());
        httpResponse.addCookie(cookie);

        seeOther(httpResponse, init.redirectPath());
    }
}


