package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

import static com.openframe.data.document.user.UserRole.OWNER;
import static com.openframe.data.service.OrganizationService.DEFAULT_ORGANIZATION_NAME;

@Slf4j
@Service
@RequiredArgsConstructor
public class TenantRegistrationService {

    private final UserService userService;
    private final TenantService tenantService;
    private final OrganizationService organizationService;
    private final RegistrationProcessor registrationProcessor;

    public Tenant registerTenant(TenantRegistrationRequest request) {

        registrationProcessor.preProcessTenantRegistration(request);

        String tenantDomain = request.getTenantDomain();

        if (tenantService.existByDomain(tenantDomain)) {
            throw new IllegalArgumentException("Registration is closed for this organization");
        }

        boolean hasActiveUser = userService.findActiveByEmail(request.getEmail())
                .isPresent();

        if (hasActiveUser) {
            throw new IllegalArgumentException("Registration is closed for this user");
        }

        Tenant tenant = tenantService.createTenant(request.getTenantName(), tenantDomain);

        AuthUser user = userService.registerUser(
                tenant.getId(),
                request.getEmail(),
                request.getFirstName(),
                request.getLastName(),
                request.getPassword(),
                List.of(OWNER)
        );

        tenant.setOwnerId(user.getId());

        Tenant savedTenant = tenantService.save(tenant);

        // Create default organization for the tenant
        createDefaultOrganization(savedTenant);

        registrationProcessor.postProcessTenantRegistration(savedTenant, user, request);

        return savedTenant;
    }

    /**
     * Create a default organization for a newly registered tenant.
     * This organization will be used for machines that don't have a specific organization assigned.
     * 
     * The default organization has:
     * - name: {@link OrganizationService#DEFAULT_ORGANIZATION_NAME}
     * - category: "General"
     * - auto-generated organizationId (UUID)
     */
    private void createDefaultOrganization(Tenant tenant) {
        log.info("Creating default organization for tenant: {}", tenant.getId());

        Organization defaultOrg = Organization.builder()
                .name(DEFAULT_ORGANIZATION_NAME)
                .organizationId(UUID.randomUUID().toString())
                .category("General")
                .deleted(false)
                .build();

        Organization created = organizationService.createOrganization(defaultOrg);
        
        log.info("Created default organization '{}' with organizationId: {} for tenant: {}", 
                created.getName(), created.getOrganizationId(), tenant.getId());
    }
}