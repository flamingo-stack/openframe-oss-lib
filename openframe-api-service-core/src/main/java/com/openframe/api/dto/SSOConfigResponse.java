package com.openframe.api.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SSOConfigResponse {
    private String id;
    private String provider;
    private String clientId;
    private String clientSecret;
    private boolean autoProvisionUsers;
    private String msTenantId;
    private boolean enabled;
    private List<String> allowedDomains;
} 