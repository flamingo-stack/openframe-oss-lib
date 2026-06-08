package com.openframe.authz.service.tenant;

import com.openframe.authz.service.validation.RegistrationValidationService;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Service for managing tenants in multi-tenant architecture
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;
    private final RegistrationValidationService registrationValidationService;

    /**
     * Create a new tenant with a caller-supplied id. The registration flow passes the id from
     * {@link com.openframe.authz.service.processor.RegistrationProcessor#reserveTenantIdForRegistration}:
     * SaaS reserves the pre-generated tenantId of a claimed READY cluster (so the Tenant id
     * matches its tenant_cluster_registrations row); OSS reserves a fresh UUID.
     */
    public Tenant createTenant(String tenantId, String tenantName, String domain) {
        log.debug("Creating tenant: {} with domain: {} (id={})", tenantName, domain, tenantId);

        registrationValidationService.ensureTenantDomainAvailable(domain);

        Tenant tenant = Tenant.builder()
                .id(tenantId)
                .name(tenantName)
                .domain(domain)
                .status(TenantStatus.ACTIVE)
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