package com.openframe.authz.service.tenant;

import com.openframe.authz.service.validation.RegistrationValidationService;
import com.openframe.core.exception.AuthFlowException;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantDisplayId;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Optional;

import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_BLOCKED;
import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_INACTIVE;
import static org.springframework.util.StringUtils.hasText;

/**
 * Service for managing tenants in multi-tenant architecture
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class TenantService {

    private static final int DISPLAY_ID_ATTEMPTS = 5;

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

        // createdAt is set explicitly: with a pre-assigned id Spring Data treats the tenant as existing,
        // so Mongo auditing only fills @LastModifiedDate and never @CreatedDate.
        Tenant tenant = Tenant.builder()
                .id(tenantId)
                .name(tenantName)
                .domain(domain)
                .displayId(newDisplayId())
                .status(TenantStatus.ACTIVE)
                .createdAt(LocalDateTime.now())
                .build();

        Tenant savedTenant = tenantRepository.save(tenant);
        log.info("Created tenant: {} with ID: {} and domain: {}", savedTenant.getName(), savedTenant.getId(), savedTenant.getDomain());

        return savedTenant;
    }

    /**
     * A display id no tenant carries yet. A clash is unlikely (32^8 values), so a few draws are plenty; the unique
     * index still refuses the rare race between the check and the save.
     */
    private String newDisplayId() {
        for (int attempt = 0; attempt < DISPLAY_ID_ATTEMPTS; attempt++) {
            String candidate = TenantDisplayId.generate();
            if (!tenantRepository.existsByDisplayId(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("No free tenant display id after " + DISPLAY_ID_ATTEMPTS + " attempts");
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

    // Every login path refuses a tenant the same way: a blocked one says so, anything else not ACTIVE says nothing new.
    public void refuseLoginUnlessActive(String tenantId) {
        TenantStatus status = statusOf(tenantId);
        if (status == TenantStatus.BLOCKED) {
            throw new AuthFlowException(ACCOUNT_BLOCKED, ACCOUNT_BLOCKED.getMessage());
        }
        if (status != TenantStatus.ACTIVE) {
            throw new AuthFlowException(ACCOUNT_INACTIVE, ACCOUNT_INACTIVE.getMessage());
        }
    }

    // A tenant document without a status is ACTIVE (the document default); a blank or unknown id has no tenant.
    private TenantStatus statusOf(String tenantId) {
        if (!hasText(tenantId)) {
            return TenantStatus.DELETED;
        }
        return tenantRepository.findById(tenantId)
                .map(tenant -> Objects.requireNonNullElse(tenant.getStatus(), TenantStatus.ACTIVE))
                .orElse(TenantStatus.DELETED);
    }

    /**
     * Save tenant
     */
    public Tenant save(Tenant tenant) {
        return tenantRepository.save(tenant);
    }
}