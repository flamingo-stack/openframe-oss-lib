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

// Per-tenant DB-side overrides for frontend feature flags; flags present here take precedence over yml defaults.
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

