package com.openframe.data.document.sso;

import lombok.Data;
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
     * Indicates whether this SSO configuration is active.
     * A config is active when it's enabled and has non-empty client credentials.
     */
    public boolean isActive() {
        return isEnabled()
                && getClientId() != null && !getClientId().trim().isEmpty()
                && getClientSecret() != null && !getClientSecret().trim().isEmpty();
    }
}