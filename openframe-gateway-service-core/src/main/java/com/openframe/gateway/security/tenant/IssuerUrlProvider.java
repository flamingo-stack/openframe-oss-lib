package com.openframe.gateway.security.tenant;

import reactor.core.publisher.Mono;

import java.util.List;

/**
 * Resolves the JWT issuer URL(s) accepted by this gateway pod.
 *
 * The OSS default impl reads the (sole) Tenant from the local DB.
 * SaaS deployments override with a @Primary impl that reads the tenantId from
 * tenant_cluster_registrations.findByClusterName(TENANT_ID) — the only correct
 * source when many tenants share the same physical Mongo collection.
 */
public interface IssuerUrlProvider {

    Mono<List<String>> resolveIssuerUrls();

    List<String> getCachedIssuerUrl();
}
