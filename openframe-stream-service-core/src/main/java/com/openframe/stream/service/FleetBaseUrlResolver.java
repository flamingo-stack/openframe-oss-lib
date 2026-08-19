package com.openframe.stream.service;

/**
 * Resolves the Fleet MDM base URL for a specific tenant.
 *
 * <p>In per-tenant clusters the stream service and Fleet share a cluster, so the static
 * {@code fleet.mdm.base-url} (an in-cluster ClusterIP URL) is always correct and this bean is
 * absent. In the shared cluster there is no local Fleet: each event tenant's Fleet lives in that
 * tenant's cluster, reachable over the private zone via the cluster's registered internal DNS —
 * so the URL must be resolved per tenant. Same optional-bean seam as
 * {@link ClusterTenantIdResolver}: only the shared-plane stream deployment provides an
 * implementation; everywhere else {@link FleetMdmCacheService} keeps the static property.
 */
public interface FleetBaseUrlResolver {

    /**
     * @param tenantId canonical tenant id (the event's resolved tenant)
     * @return the tenant's Fleet base URL, or {@code null} when it cannot be resolved —
     *         the caller then falls back to the static {@code fleet.mdm.base-url}
     */
    String resolveBaseUrl(String tenantId);
}
