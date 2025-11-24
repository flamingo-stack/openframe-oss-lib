package com.openframe.data.document.sso;

import lombok.Data;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "sso_configs")
public class SSOConfig {
    @Id
    private String id;
    private String provider;
    private String clientId;
    private String clientSecret;
    private boolean enabled;
    /**
     * If true, users authenticated via this SSO provider may be auto-provisioned in the system.
     * If false, only pre-existing users are allowed to sign in via this provider.
     */
    private boolean autoProvisionUsers;
    /**
     * Microsoft Entra tenant ID for Office 365 OIDC (optional for common endpoints).
     */
    private String msTenantId;

    /**
     * Whitelisted email domains for auto-provisioning. If empty/null, any domain is allowed.
     */
    private List<String> allowedDomains;

}