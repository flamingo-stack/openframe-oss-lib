package com.openframe.gateway.security.tenant;

import com.openframe.data.reactive.repository.tenant.ReactiveTenantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * OSS default: reads the single Tenant from the local DB. Correct for OSS
 * deployments where each pod has its own Mongo with exactly one tenant.
 * Replaced by SaasIssuerUrlProvider (@Primary) in SaaS deployments.
 */
@Component
@Slf4j
public class DefaultIssuerUrlProvider implements IssuerUrlProvider {

    private final ReactiveTenantRepository tenantRepository;

    @Value("${openframe.security.jwt.allowed-issuer-base}")
    private String allowedIssuerBase;

    @Value("${openframe.security.jwt.super-tenant-id:}")
    private String superTenantId;

    private final AtomicReference<Mono<List<String>>> ref = new AtomicReference<>();
    private volatile List<String> cachedIssuers;

    public DefaultIssuerUrlProvider(ReactiveTenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    @Override
    public Mono<List<String>> resolveIssuerUrls() {
        Mono<List<String>> cached = ref.get();
        if (cached != null) return cached;

        Mono<List<String>> created = tenantRepository.findAll().next()
                .switchIfEmpty(Mono.error(new IllegalStateException("No tenants found")))
                .map(t -> buildIssuerList(t.getId()))
                .doOnNext(list -> this.cachedIssuers = list)
                .cache();

        if (ref.compareAndSet(null, created)) {
            return created.onErrorResume(e -> {
                ref.compareAndSet(created, null);
                return Mono.error(e);
            });
        } else {
            return ref.get();
        }
    }

    @Override
    public List<String> getCachedIssuerUrl() {
        if (cachedIssuers == null || cachedIssuers.isEmpty()) {
            resolveIssuerUrls().subscribe();
        }
        return cachedIssuers != null ? cachedIssuers : Collections.emptyList();
    }

    private List<String> buildIssuerList(String tenantId) {
        String dbIssuer = allowedIssuerBase + "/" + tenantId;
        List<String> list = new ArrayList<>(2);
        list.add(dbIssuer);
        if (superTenantId != null && !superTenantId.isBlank()) {
            String superIssuer = allowedIssuerBase + "/" + superTenantId;
            if (!superIssuer.equals(dbIssuer)) {
                list.add(superIssuer);
            }
        }
        return Collections.unmodifiableList(list);
    }
}
