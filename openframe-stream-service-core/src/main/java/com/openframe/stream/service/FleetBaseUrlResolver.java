package com.openframe.stream.service;

/**
 * Resolves the Fleet MDM base URL for a specific tenant.
 *
 * <p>In per-tenant clusters the stream service and Fleet share a cluster, so the static
 * {@code fleet.mdm.base-url} (an in-cluster ClusterIP URL) is always correct and this bean is
 * typically a no-op implementation that always returns {@code null}, deferring to that
 * static configuration.
 */
public interface FleetBaseUrlResolver {

    /**
     * @param tenantId canonical tenant id (the event's resolved tenant)
     * @return the tenant's Fleet base URL, or {@code null} when it cannot be resolved —
     *         the caller then falls back to the static {@code fleet.mdm.base-url}
     */
    String resolveBaseUrl(String tenantId);
}

