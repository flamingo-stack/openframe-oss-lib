package com.openframe.stream.service;

import com.openframe.data.model.enums.IntegratedToolType;

// Resolves a canonical tenantId from a cluster-level identifier; only deployed in the shared cluster.
public interface ClusterTenantIdResolver {

    // clusterName is the cluster-scoped identifier extracted from the event payload; returns null when no tenant matches
    String resolveTenantId(String clusterName);

    // Tool-aware resolution: key is the tool-specific tenant discriminator (MeshCentral domain, Fleet team_id, …)
    default String resolveTenantId(IntegratedToolType toolType, String key) {
        return resolveTenantId(key);
    }
}
