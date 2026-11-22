package com.openframe.authz.controller;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.exception.PasswordSignupDomainUnavailableException;
import com.openframe.authz.security.RegistrationSessionLogin;
import com.openframe.authz.service.processor.PasswordSignupProcessor;
import com.openframe.authz.service.tenant.TenantRegistrationService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.dto.ErrorResponse;
import com.openframe.data.document.tenant.Tenant;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import static com.openframe.core.exception.ErrorCode.BAD_REQUEST;

/** Registers a workspace through the password form using the deployment's signup policy. */
@RestController
@RequestMapping(path = "/oauth", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class TenantRegistrationController {

    private final TenantRegistrationService registrationService;
    private final UserService userService;
    private final RegistrationSessionLogin registrationSessionLogin;
    private final ObjectProvider<PasswordSignupProcessor> passwordSignupProcessor;

    @PostMapping(path = "/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Tenant> register(@Valid @RequestBody TenantRegistrationRequest request,
                                           HttpServletRequest httpRequest,
                                           HttpServletResponse httpResponse) {
        PasswordSignupProcessor protectedSignup = passwordSignupProcessor.getIfAvailable();
        if (protectedSignup != null) {
            protectedSignup.acceptPasswordSignup(request);
            return ResponseEntity.accepted().build();
        }

        Tenant tenant = registrationService.registerTenant(request);
        userService.findActiveById(tenant.getOwnerId())
                .ifPresent(owner -> registrationSessionLogin.signIn(owner, httpRequest, httpResponse));
        return ResponseEntity.ok(tenant);
    }

    @ExceptionHandler(PasswordSignupDomainUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleUnavailableDomain(PasswordSignupDomainUnavailableException exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse(BAD_REQUEST.getCode(), exception.getMessage()));
    }
}
