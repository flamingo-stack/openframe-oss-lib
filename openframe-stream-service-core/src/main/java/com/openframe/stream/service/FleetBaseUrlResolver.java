package com.openframe.stream.service;

/**
 * Finds the Fleet URL for a given tenant.
 *
 * <p>This repo has no implementation on purpose. On a tenant cluster Fleet is in the same cluster,
 * so the fixed {@code fleet.mdm.base-url} from config is always right and there is nothing to look
 * up — the dependency is optional and stays null. The only implementation is in
 * openframe-saas-shared, where one service talks to many tenants' Fleets and has to pick the URL
 * per tenant.
 */
public interface FleetBaseUrlResolver {

    /**
     * @param tenantId canonical tenant id (the event's resolved tenant)
     * @return the tenant's Fleet base URL, or {@code null} when it cannot be resolved —
     *         the caller then falls back to the static {@code fleet.mdm.base-url}
     */
    String resolveBaseUrl(String tenantId);
}
