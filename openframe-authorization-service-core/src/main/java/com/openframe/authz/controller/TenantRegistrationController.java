package com.openframe.authz.controller;

import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.SsoFlowCookies;
import com.openframe.authz.service.sso.SsoTenantRegistrationService;
import com.openframe.authz.service.sso.SsoAuthorizeData;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.data.document.tenant.Tenant;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import static com.openframe.authz.security.SsoRegistrationConstants.COOKIE_SSO_REG;
import static com.openframe.authz.web.AuthStateUtils.clearAuthState;
import static com.openframe.authz.web.AuthStateUtils.clearOtherSsoFlowCookies;
import static com.openframe.authz.web.Redirects.seeOther;
import static org.springframework.http.HttpStatus.OK;

@Slf4j
@RestController
@RequestMapping(path = "/oauth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class TenantRegistrationController {

    private final TenantRegistrationService registrationService;
    private final SsoTenantRegistrationService ssoRegistrationService;
    private final SsoFlowCookies ssoFlowCookies;

    @Value("${openframe.auth.error-url}")
    private String authErrorUrl;

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
        try {
            clearAuthState(httpRequest, httpResponse);
            clearOtherSsoFlowCookies(httpResponse, COOKIE_SSO_REG);

            SsoAuthorizeData ssoAuthorizeData = ssoRegistrationService.startRegistration(request);
            ssoFlowCookies.write(httpResponse, COOKIE_SSO_REG, ssoAuthorizeData.cookieValue(), ssoAuthorizeData.cookieTtlSeconds());

            seeOther(httpResponse, ssoAuthorizeData.redirectPath());
        } catch (Exception e) {
            log.error("SSO registration init failed: {}", e.getMessage(), e);
            String msg = URLEncoder.encode(e.getMessage() != null ? e.getMessage() : "Registration failed. Please try again.", StandardCharsets.UTF_8);
            httpResponse.sendRedirect(authErrorUrl + "?error=" + msg);
        }
    }

}


