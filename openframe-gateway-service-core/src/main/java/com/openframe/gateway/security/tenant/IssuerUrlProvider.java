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

    /**
     * Whether this gateway accepts JWTs from the given issuer.
     * <p>
     * Default behavior is fail-closed: accept only if the issuer is present in the cached list; an
     * absent or empty cache accepts nothing. Multi-tenant providers override this to accept a whole
     * family of issuers (e.g. any {@code <base>/<tenantId>}) without enumerating every tenant — the
     * per-request tenant boundary is then enforced separately.
     */
    default boolean accepts(String issuer) {
        List<String> expected = getCachedIssuerUrl();
        return expected != null && expected.contains(issuer);
    }
}
