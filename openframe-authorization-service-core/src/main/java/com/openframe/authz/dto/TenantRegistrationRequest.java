package com.openframe.authz.dto;

import com.openframe.core.validation.TenantDomain;
import com.openframe.core.validation.ValidEmail;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * User registration request DTO for multi-tenant registration
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class TenantRegistrationRequest extends CoreUserRequest {

    @ValidEmail
    private String email;

    /**
     * Organization/tenant name for registration
     * This will be used to create a new tenant if it doesn't exist
     */
    @NotBlank(message = "Organization name is required")
    @Pattern(
            regexp = "^[\\p{L}\\p{M}0-9&.,'’\"()\\- ]{2,100}$",
            message = "Invalid organization name"
    )
    private String tenantName;

    /**
     * Tenant domain
     */
    @TenantDomain
    private String tenantDomain;

    private String accessCode;

    /**
     * Optional PR number identifying a preview environment. When PR-number registration is enabled,
     * the tenant is bound to the pre-provisioned {@code tenant-<prNumber>} namespace instead of
     * claiming an arbitrary READY one. Ignored where the feature is disabled.
     */
    @Positive(message = "prNumber must be a positive number")
    private Integer prNumber;
}