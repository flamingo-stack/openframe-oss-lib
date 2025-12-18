package com.openframe.authz.controller;

import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.sso.SsoTenantRegistrationService;
import com.openframe.authz.service.sso.SsoTenantRegistrationService.SsoAuthorizeData;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.data.document.tenant.Tenant;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

import static com.openframe.authz.security.SsoRegistrationConstants.COOKIE_SSO_REG;
import static com.openframe.authz.web.AuthStateUtils.clearAuthState;
import static com.openframe.authz.web.Redirects.seeOther;
import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping(path = "/oauth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class TenantRegistrationController {

    private final TenantRegistrationService registrationService;
    private final SsoTenantRegistrationService ssoRegistrationService;

    @PostMapping(path = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public Tenant register(
            @Valid @RequestBody TenantRegistrationRequest request) {
        return registrationService.registerTenant(request);
    }

    @GetMapping(path = "/register/sso")
    public void startSsoRegistration(@Valid @ModelAttribute SsoTenantRegistrationInitRequest request,
                                     HttpServletRequest httpRequest,
                                     HttpServletResponse httpResponse) throws IOException {
        clearAuthState(httpRequest, httpResponse);

        SsoAuthorizeData ssoAuthorizeData = ssoRegistrationService.startRegistration(request);
        httpResponse.addCookie(buildSsoRegistrationCookie(ssoAuthorizeData.cookieValue(), ssoAuthorizeData.cookieTtlSeconds()));

        // Redirect to Spring Security's oauth2 authorization endpoint under onboarding tenant context via Location header
        seeOther(httpResponse, ssoAuthorizeData.redirectPath());
    }

    private Cookie buildSsoRegistrationCookie(String value, int ttlSeconds) {
        Cookie cookie = new Cookie(COOKIE_SSO_REG, value);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(ttlSeconds);
        return cookie;
    }


}


