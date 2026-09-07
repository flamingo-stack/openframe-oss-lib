package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SSOConfigResponse {
    private String id;
    private String provider;
    private String clientId;
    private boolean autoProvisionUsers;
    private String msTenantId;
    private boolean enabled;
    private List<String> allowedDomains;
} 
