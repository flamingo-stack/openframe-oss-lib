package com.openframe.data.document.apikey;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "api_keys")
public class ApiKey implements TenantScoped {
    @Id
    private String keyId;
    @Indexed private String tenantId;

    private String hashedKey;
    private String name;
    private String description;

    @Indexed
    private String userId;

    // Permissions & Scopes TODO
    private List<String> scopes;
    private List<String> roles;

    // Metadata
    private boolean enabled = true;
    private Instant expiresAt;

    // Audit: timestamps are set explicitly by ApiKeyService (keyId is assigned before the first save,
    // so Spring Data auditing would not treat the document as new). createdBy/updatedBy hold the
    // id of the user who performed the write; automated maintenance (expiry) leaves updatedBy as the
    // last user who changed the key.
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;

    /**
     * Check if the API key is expired
     */
    public boolean isExpired() {
        return expiresAt != null && Instant.now().isAfter(expiresAt);
    }

    /**
     * Check if the API key is active (enabled and not expired)
     */
    public boolean isActive() {
        return enabled && !isExpired();
    }
}
