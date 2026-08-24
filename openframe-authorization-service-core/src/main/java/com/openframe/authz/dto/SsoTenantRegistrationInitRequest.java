package com.openframe.authz.dto;

import com.openframe.core.validation.TenantDomain;
import com.openframe.core.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Initial payload to start SSO-based tenant registration.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SsoTenantRegistrationInitRequest {

    @ValidEmail
    @NotBlank(message = "Email is required")
    private String email;

    private String accessCode;

    @NotBlank(message = "Organization name is required")
    @Pattern(
            regexp = "^[\\p{L}\\p{M}0-9&.,'’\"()\\- ]{2,100}$",
            message = "Invalid organization name"
    )
    private String tenantName;

    @TenantDomain
    private String tenantDomain;

    @NotBlank(message = "Provider is required")
    private String provider;

    // Optional final redirect target (absolute or allowed host)
    private String redirectTo;

    /**
     * Mobile-app flow: forwarded to the BFF {@code /oauth/continue} after finalization so the
     * callback attaches the one-time ticket the app exchanges for tokens (same contract as
     * {@code /oauth/login?authMobile=true}).
     */
    private boolean authMobile;

    private RegistrationAttribution attribution;
}

