package com.openframe.authz.dto;

import com.openframe.core.validation.TenantDomain;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Initial payload to start SSO-based tenant registration.
 * Contains only organization details and chosen identity provider.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SsoTenantRegistrationInitRequest {

    /**
     * Organization/tenant name for registration.
     */
    @NotBlank(message = "Organization name is required")
    @Pattern(
            regexp = "^[\\p{L}\\p{M}0-9&.,'’\"()\\- ]{2,100}$",
            message = "Invalid organization name"
    )
    private String tenantName;

    /**
     * Full tenant domain (e.g. acme.example.com).
     */
    @TenantDomain
    private String tenantDomain;

    /**
     * SSO provider id to use (e.g. 'google', 'microsoft').
     */
    @NotBlank(message = "Provider is required")
    private String provider;
}

