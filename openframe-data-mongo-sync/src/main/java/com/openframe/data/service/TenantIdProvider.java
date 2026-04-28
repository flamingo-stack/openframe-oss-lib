package com.openframe.data.service;

/**
 * Provides the tenantId for the running pod.
 *
 * The OSS default impl returns the TENANT_ID env value as-is.
 * SaaS deployments override with a @Primary impl that looks up
 * tenant_cluster_registrations by clusterName (== TENANT_ID env value)
 * and returns the registration's pre-generated tenantId UUID.
 */
public interface TenantIdProvider {

    String getTenantId();
}
