package com.openframe.api.service.tenant;

import com.openframe.core.exception.InternalException;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The domain of the tenant this pod serves, which is the isolation key for anything stored per tenant domain rather
 * than per tenant id - agent logs in the shared Loki above all.
 * <p>
 * Preferred source is the request itself: the shared gateway resolves a tenant by looking its {@code Host} up as
 * {@code tenants.domain}, then stamps that same value on the request. A client cannot forge it, because the gateway
 * strips the header from every inbound request before injecting its own. Taking it from the request also means a
 * tenant whose {@code tenants} document has not replicated into its own database yet still gets its logs.
 * <p>
 * Falls back to resolving the pod's configured tenant id through the {@code tenants} collection, for the callers that
 * have no request in scope. That lookup is cached for the life of the pod: a tenant pod serves one tenant and tenant
 * domains never change. A missing domain is not cached, so a tenant still being provisioned recovers on a later call.
 */
@Service
@Slf4j
public class TenantDomainService {

    /** Used where no transport contributes a provider bean, e.g. a stream service built on this module. */
    private static final RequestTenantDomainProvider NO_REQUEST = Optional::empty;

    private final ObjectProvider<RequestTenantDomainProvider> requestDomainProvider;
    private final TenantIdProvider tenantIdProvider;
    private final TenantRepository tenantRepository;
    private final Map<String, String> domainsByTenantId = new ConcurrentHashMap<>();

    public TenantDomainService(ObjectProvider<RequestTenantDomainProvider> requestDomainProvider,
                               TenantIdProvider tenantIdProvider,
                               TenantRepository tenantRepository) {
        this.requestDomainProvider = requestDomainProvider;
        this.tenantIdProvider = tenantIdProvider;
        this.tenantRepository = tenantRepository;
    }

    /**
     * @throws InternalException when neither the request nor the {@code tenants} collection yields a domain, which
     *                           means this tenant cannot be isolated and no per-domain data may be read.
     */
    public String getTenantDomain() {
        return requestDomainProvider.getIfAvailable(() -> NO_REQUEST)
                .currentTenantDomain()
                .filter(StringUtils::hasText)
                .orElseGet(this::fromTenantRecord);
    }

    private String fromTenantRecord() {
        String tenantId = tenantIdProvider.getTenantId();
        String domain = domainsByTenantId.computeIfAbsent(tenantId, this::findDomain);
        if (domain == null) {
            log.error("Tenant {} has no domain, and the request carried none", tenantId);
            throw new InternalException("Tenant domain is not available");
        }
        return domain;
    }

    private String findDomain(String tenantId) {
        return tenantRepository.findById(tenantId)
                .map(Tenant::getDomain)
                .filter(StringUtils::hasText)
                .orElse(null);
    }
}
