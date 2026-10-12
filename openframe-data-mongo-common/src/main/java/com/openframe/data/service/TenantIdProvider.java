package com.openframe.data.service;
// SaaS overrides with @Primary impl resolving clusterName -> tenantId via tenant_cluster_registrations
public interface TenantIdProvider {
    String getTenantId();
    // SaaS impl may return false until the cluster is provisioned
    default boolean isTenantRegistered() {
        return true;
    }
}

