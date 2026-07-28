package com.openframe.authz.controller;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.dto.SsoInvitationAcceptRequest;
import com.openframe.authz.security.SsoFlowCookies;
import com.openframe.authz.security.SsoRegistrationConstants;
import com.openframe.authz.service.sso.SsoAuthorizeData;
import com.openframe.authz.service.sso.SsoInvitationService;
import com.openframe.authz.service.user.InvitationRegistrationService;
import com.openframe.data.document.auth.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import static com.openframe.authz.web.AuthStateUtils.clearAuthState;
import static com.openframe.authz.web.AuthStateUtils.clearOtherSsoFlowCookies;
import static com.openframe.authz.web.Redirects.seeOther;
import static org.springframework.http.HttpStatus.OK;

@Slf4j
@RestController
@RequestMapping(path = "/invitations", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class InvitationRegistrationController {

    private final InvitationRegistrationService invitationRegistrationService;
    private final SsoInvitationService ssoInvitationService;
    private final SsoFlowCookies ssoFlowCookies;

    @Value("${openframe.auth.error-url}")
    private String authErrorUrl;

    @PostMapping(path = "/accept", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public AuthUser register(@Valid @RequestBody InvitationRegistrationRequest request) {
        return invitationRegistrationService.registerByInvitation(request);
    }

    @GetMapping(path = "/accept/sso")
    public void acceptViaSso(@Valid @ModelAttribute SsoInvitationAcceptRequest request,
                             HttpServletRequest httpRequest,
                             HttpServletResponse httpResponse) throws Exception {
        try {
            clearAuthState(httpRequest, httpResponse);
            clearOtherSsoFlowCookies(httpResponse, SsoRegistrationConstants.COOKIE_SSO_INVITE);
            SsoAuthorizeData init = ssoInvitationService.startAccept(request);
            ssoFlowCookies.write(httpResponse, SsoRegistrationConstants.COOKIE_SSO_INVITE,
                    init.cookieValue(), init.cookieTtlSeconds());

            seeOther(httpResponse, init.redirectPath());
        } catch (Exception e) {
            log.error("SSO invitation accept failed: {}", e.getMessage(), e);
            String msg = URLEncoder.encode(e.getMessage() != null ? e.getMessage() : "Invitation acceptance failed. Please try again.", StandardCharsets.UTF_8);
            httpResponse.sendRedirect(authErrorUrl + "?error=" + msg);
        }
    }
}


