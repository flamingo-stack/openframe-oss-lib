package com.openframe.authz.controller;

import com.openframe.authz.dto.EmailAvailabilityResponse;
import com.openframe.authz.dto.EmailDomainAllowedResponse;
import com.openframe.authz.dto.TenantDiscoveryResponse;
import com.openframe.authz.service.tenant.TenantDiscoveryService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.config.AuthHardeningProperties;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.core.email.EmailVerdict;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.Locale;

import static org.springframework.http.HttpStatus.OK;

/**
 * Controller for tenant discovery and availability checking
 * Used during the multi-tenant login and registration flow
 */
@Slf4j
@RestController
@RequestMapping("/tenant")
@RequiredArgsConstructor
public class TenantDiscoveryController {

    private final TenantDiscoveryService tenantDiscoveryService;
    private final UserService userService;
    private final EmailDomainPolicy emailDomainPolicy;
    private final AuthHardeningProperties hardening;

    /**
     * Discover tenants and authentication providers for a given email
     * Used in the returning user flow
     */
    @GetMapping(value = "/discover", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public TenantDiscoveryResponse discoverTenants(
            @RequestParam @Email @NotBlank String email, HttpServletResponse response) {

        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        log.debug("Tenant discovery request for email: {}", email);
        return tenantDiscoveryService.discoverTenantForEmail(email.toLowerCase(Locale.ROOT));
    }

    /** Keeps the legacy signup check usable without exposing existing accounts when hardening is enabled. */
    @GetMapping(value = "/email-available", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public EmailAvailabilityResponse emailAvailable(
            @RequestParam @Email @NotBlank String email) {

        String normalizedEmail = email.toLowerCase(Locale.ROOT);

        boolean taken = !hardening.enabled() && userService.existsActiveByEmail(normalizedEmail);
        if (taken) {
            return EmailAvailabilityResponse.taken();
        }
        EmailVerdict verdict = emailDomainPolicy.verdict(email);
        return EmailAvailabilityResponse.of(verdict);
    }

    /**
     * The email policy alone, ignoring whether the address is registered: lets the UI flag a blocked address or
     * domain as the user types.
     */
    @GetMapping(value = "/email-domain-allowed", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public EmailDomainAllowedResponse emailDomainAllowed(
            @RequestParam @Email @NotBlank String email) {

        EmailVerdict verdict = emailDomainPolicy.verdict(email);
        return EmailDomainAllowedResponse.of(verdict);
    }
}
