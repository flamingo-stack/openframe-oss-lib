package com.openframe.data.document.device;

import lombok.Data;

import java.util.Map;

@Data
public class SecuritySettings {
    private boolean firewallEnabled;
    private boolean antivirusEnabled;
    private String encryptionStatus;
    private String lastSecurityScan;
    private Map<String, String> securityPolicies;
}
