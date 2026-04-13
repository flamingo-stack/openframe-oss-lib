package com.openframe.data.document.featureflags;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Per-cluster document holding DB-side overrides for frontend feature flags.
 * Any property present in {@link #flags} takes precedence over the value
 * configured in {@code openframe.fe-feature-flag.*}; missing properties fall
 * back to the yml configuration default.
 *
 * <p>The Mongo {@code _id} is the cluster id ({@code openframe.cluster-id}),
 * so the collection naturally supports the future migration of all tenants
 * into a single shared cluster.
 */
@Document(collection = "fe_feature_flags")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FeFeatureFlags {

    /** Cluster id — used as the Mongo {@code _id} (one document per cluster). */
    @Id
    private String clusterId;

    @Builder.Default
    private Map<String, Boolean> flags = new LinkedHashMap<>();

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;
}
