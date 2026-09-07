package com.openframe.data.document.device;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecuritySettings {
    private boolean firewallEnabled;
    private boolean antivirusEnabled;
    private String encryptionStatus;
    private String lastSecurityScan;
    private Map<String, String> securityPolicies;
}
