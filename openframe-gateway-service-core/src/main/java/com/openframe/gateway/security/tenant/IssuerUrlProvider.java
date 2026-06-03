package com.openframe.gateway.security.tenant;

import reactor.core.publisher.Mono;
import java.util.List;

/**
 * Resolves JWT issuer URLs accepted by this gateway pod.
 * OSS default reads the single Tenant from local DB.
 * SaaS overrides with @Primary impl reading from tenant_cluster_registrations.
 */
public interface IssuerUrlProvider {
    Mono<List<String>> resolveIssuerUrls();
    List<String> getCachedIssuerUrl();
}
