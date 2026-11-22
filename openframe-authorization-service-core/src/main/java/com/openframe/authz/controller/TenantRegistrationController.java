package com.openframe.authz.controller;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.security.RegistrationSessionLogin;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.tenant.Tenant;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import static org.springframework.http.HttpStatus.OK;

@RestController
@RequestMapping(path = "/oauth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class TenantRegistrationController {

    private final TenantRegistrationService registrationService;
    private final UserService userService;
    private final RegistrationSessionLogin registrationSessionLogin;

    /**
     * Registers the tenant and signs its owner into the auth-server session, so the client continues
     * through {@code /oauth/continue?tenantId=...} straight into the new tenant — no separate login and
     * no wait for the verification email, matching SSO signup. The email still gets verified via the
     * link the registration post-processing sends.
     */
    @PostMapping(path = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public Tenant register(@Valid @RequestBody TenantRegistrationRequest request,
                           HttpServletRequest httpRequest,
                           HttpServletResponse httpResponse) {
        Tenant tenant = registrationService.registerTenant(request);
        userService.findActiveById(tenant.getOwnerId())
                .ifPresent(owner -> registrationSessionLogin.signIn(owner, httpRequest, httpResponse));
        return tenant;
    }
}
