package com.openframe.data.document.featureflags;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Per-tenant document holding DB-side overrides for frontend feature flags.
 * Any property present in {@link #flags} takes precedence over the value
 * configured in {@code openframe.fe-feature-flag.*}; missing properties fall
 * back to the yml configuration default.
 *
 * <p>The document is {@link TenantScoped} via {@link #tenantId}, so the
 * collection holds one document per tenant and naturally supports all tenants
 * sharing a single cluster.
 */
@Document(collection = "fe_feature_flags")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeFeatureFlags implements TenantScoped {
    @Id
    private String id;

    @Builder.Default
    private Map<String, Boolean> flags = new LinkedHashMap<>();

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    @Indexed
    private String tenantId;
}
