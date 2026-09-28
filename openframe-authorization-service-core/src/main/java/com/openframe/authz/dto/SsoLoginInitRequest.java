package com.openframe.authz.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Starts an email-less SSO login: no email, no tenant — the provider callback decides both.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SsoLoginInitRequest {

    @NotBlank(message = "Provider is required")
    private String provider;

    /** Optional final redirect target (absolute or allowed host). */
    private String redirectTo;

    /** Mobile-app flow: forwarded to the BFF {@code /oauth/continue} — see {@link SsoTenantRegistrationInitRequest#isAuthMobile()}. */
    private boolean authMobile;
}
