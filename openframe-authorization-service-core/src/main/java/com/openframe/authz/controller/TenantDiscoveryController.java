package com.openframe.authz.controller;

import com.openframe.authz.dto.EmailAvailabilityResponse;
import com.openframe.authz.dto.EmailDomainAllowedResponse;
import com.openframe.authz.dto.TenantDiscoveryResponse;
import com.openframe.authz.service.tenant.TenantDiscoveryService;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.core.email.EmailVerdict;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    /**
     * Discover tenants and authentication providers for a given email
     * Used in the returning user flow
     */
    @GetMapping(value = "/discover", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public TenantDiscoveryResponse discoverTenants(
            @RequestParam @Email @NotBlank String email) {

        log.debug("Tenant discovery request for email: {}", email);
        return tenantDiscoveryService.discoverTenantForEmail(email.toLowerCase(Locale.ROOT));
    }

    /**
     * Check whether an email is available for a new registration.
     * Available means no active user currently owns the address (matching the global uniqueness
     * check enforced by tenant registration) AND its domain passes the email domain policy —
     * the same two rules registration itself applies.
     */
    @GetMapping(value = "/email-available", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public EmailAvailabilityResponse emailAvailable(
            @RequestParam @Email @NotBlank String email) {

        String normalizedEmail = email.toLowerCase(Locale.ROOT);

        // Cheap local lookup first, so an already-registered address never triggers the
        // domain policy's external disposable-domain call.
        boolean taken = userService.existsActiveByEmail(normalizedEmail);
        if (taken) {
            return EmailAvailabilityResponse.builder()
                    .available(false)
                    .reason(EmailAvailabilityResponse.Reason.TAKEN)
                    .build();
        }

        EmailVerdict verdict = emailDomainPolicy.verdict(normalizedEmail);
        if (!verdict.isAllowed()) {
            return EmailAvailabilityResponse.builder()
                    .available(false)
                    .reason(verdict == EmailVerdict.BLOCKED_ADDRESS
                            ? EmailAvailabilityResponse.Reason.BLOCKED_ADDRESS
                            : EmailAvailabilityResponse.Reason.BLOCKED_DOMAIN)
                    .build();
        }

        return EmailAvailabilityResponse.builder()
                .available(true)
                .build();
    }

    /**
     * Check an address against the email policy alone — ignoring whether it is already
     * registered. Lets the UI flag a disposable or privacy-focused provider as the user types,
     * without conflating it with the availability check, and says which layer blocked it
     * ({@code reason}: a blocked address, a blocked domain or a disposable one; null when allowed).
     */
    @GetMapping(value = "/email-domain-allowed", produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(OK)
    public EmailDomainAllowedResponse emailDomainAllowed(
            @RequestParam @Email @NotBlank String email) {

        EmailVerdict verdict = emailDomainPolicy.verdict(email.toLowerCase(Locale.ROOT));
        return EmailDomainAllowedResponse.builder()
                .allowed(verdict.isAllowed())
                .reason(toReason(verdict))
                .build();
    }

    private static EmailDomainAllowedResponse.Reason toReason(EmailVerdict verdict) {
        return switch (verdict) {
            case ALLOWED -> null;
            case BLOCKED_ADDRESS -> EmailDomainAllowedResponse.Reason.BLOCKED_ADDRESS;
            case BLOCKED_DOMAIN -> EmailDomainAllowedResponse.Reason.BLOCKED_DOMAIN;
            case DISPOSABLE -> EmailDomainAllowedResponse.Reason.DISPOSABLE;
        };
    }
}