package com.openframe.data.service;
/**
 * Provides the tenantId for the running pod.
 * OSS default returns TENANT_ID env var. SaaS overrides with @Primary impl
 * that resolves clusterName -> tenantId via tenant_cluster_registrations.
 */
public interface TenantIdProvider {
    String getTenantId();
    /**
     * Returns true if a tenant is registered and ready.
     * OSS default always returns true (env-var based; no registration needed).
     * SaaS impl may return false until the cluster is provisioned.
     */
    default boolean isTenantRegistered() {
        return true;
    }
}
