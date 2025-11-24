package com.openframe.authz.service.tenant;

import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantPlan;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

import static java.time.LocalDateTime.now;

/**
 * Service for managing tenants in multi-tenant architecture
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;

    /**
     * Create a new tenant
     */
    public Tenant createTenant(String tenantName, String domain) {
        log.debug("Creating tenant: {} with domain: {}", tenantName, domain);

        if (tenantRepository.existsByDomain(domain)) {
            throw new IllegalArgumentException("Tenant domain already exists");
        }

        Tenant tenant = Tenant.builder()
                .id(Tenant.generateTenantId())
                .name(tenantName)
                .domain(domain)
                .createdAt(now())
                .status(TenantStatus.ACTIVE)
                .plan(TenantPlan.FREE)
                .build();

        Tenant savedTenant = tenantRepository.save(tenant);
        log.info("Created tenant: {} with ID: {} and domain: {}", savedTenant.getName(), savedTenant.getId(), savedTenant.getDomain());

        return savedTenant;
    }

    /**
     * Find tenant by domain
     */
    public boolean existByDomain(String domain) {
        return tenantRepository.existsByDomain(domain);
    }

    /**
     * Find tenant by ID
     */
    public Optional<Tenant> findById(String tenantId) {
        return tenantRepository.findById(tenantId);
    }

    public Optional<Tenant> findFirst() {
        return tenantRepository.findAll().stream().findFirst();
    }

    /**
     * Save tenant
     */
    public Tenant save(Tenant tenant) {
        return tenantRepository.save(tenant);
    }
}