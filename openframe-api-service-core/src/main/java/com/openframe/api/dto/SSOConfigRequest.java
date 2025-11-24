package com.openframe.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class SSOConfigRequest {

    @NotBlank(message = "Client ID cannot be empty")
    private String clientId;

    @NotBlank(message = "Client Secret cannot be empty")
    private String clientSecret;

    /**
     * If true, users authenticated via this SSO provider may be auto-provisioned in the system.
     * If false, only pre-existing users are allowed to sign in via this provider.
     */
    private Boolean autoProvisionUsers;

    private String msTenantId;

    /**
     * Whitelisted email domains for auto-provisioning.
     */
    private List<String> allowedDomains;
} 