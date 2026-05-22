package com.openframe.stream.service;

/**
 * Resolves a canonical tenantId from a cluster-level identifier carried by an
 * integrated-tool event (e.g. the MeshCentral {@code domain} in shared SaaS
 * deployments where one upstream cluster serves multiple tenants).
 *
 * <p>Only deployed in the shared cluster — in per-tenant clusters the bean is
 * absent and {@link IntegratedToolDataEnrichmentService} falls back to
 * {@link com.openframe.data.service.TenantIdProvider}.
 */
public interface ClusterTenantIdResolver {

    /**
     * @param clusterName cluster-scoped identifier extracted from the event payload
     * @return canonical tenantId, or {@code null} when no tenant matches
     */
    String resolveTenantId(String clusterName);
}
