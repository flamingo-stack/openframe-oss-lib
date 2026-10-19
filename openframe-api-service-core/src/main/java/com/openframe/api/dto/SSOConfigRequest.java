package com.openframe.api.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SSOConfigRequest {

    @NotBlank(message = "Client ID cannot be empty")
    private String clientId;

    @NotBlank(message = "Client Secret cannot be empty")
    private String clientSecret;

    // If true, users may be auto-provisioned; if false, only pre-existing users may sign in.
    private Boolean autoProvisionUsers;

    private String msTenantId;

    // Whitelisted email domains for auto-provisioning.
    private List<String> allowedDomains;
} 

