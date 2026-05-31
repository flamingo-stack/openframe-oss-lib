package com.openframe.gateway.security.tenant;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.Collections;
import java.util.List;

/**
 * Self-hosted (OSS) fallback: accepts JWTs from a single issuer defined by
 * openframe.security.jwt.super-tenant-id config. No DB lookup needed —
 * single-tenant deployments have a fixed issuer URL.
 * Activated only when no other IssuerUrlProvider bean is present (e.g. SaasIssuerUrlProvider).
 */
@Component
@ConditionalOnMissingBean(value = IssuerUrlProvider.class, ignored = DefaultIssuerUrlProvider.class)
public class DefaultIssuerUrlProvider implements IssuerUrlProvider {

    @Value("${openframe.security.jwt.allowed-issuer-base}")
    private String allowedIssuerBase;

    @Value("${openframe.security.jwt.super-tenant-id}")
    private String superTenantId;

    @Override
    public Mono<List<String>> resolveIssuerUrls() {
        return Mono.just(getCachedIssuerUrl());
    }

    @Override
    public List<String> getCachedIssuerUrl() {
        return Collections.singletonList(allowedIssuerBase + "/" + superTenantId);
    }
}
