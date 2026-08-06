package com.openframe.data.document.sso;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "sso_configs")
public class SSOConfig implements TenantScoped {
    @Id
    private String id;
    @Indexed private String tenantId;

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
     * Apple Developer Team ID — issuer of the client-secret JWT. For Apple configs the
     * {@code clientSecret} field holds the .p8 private key (PEM) the JWT is signed with.
     */
    private String teamId;
    /**
     * Apple Key ID of the "Sign in with Apple" .p8 key — the JWT's {@code kid} header.
     */
    private String keyId;

    /**
     * Whitelisted email domains for auto-provisioning. If empty/null, any domain is allowed.
     */
    private List<String> allowedDomains;
}
