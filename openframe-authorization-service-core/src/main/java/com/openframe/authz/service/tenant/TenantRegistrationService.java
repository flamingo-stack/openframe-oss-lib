package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.user.UserService;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.openframe.data.document.user.UserRole.OWNER;
import static java.util.Locale.ROOT;

/** Creates the tenant, owner and default organization required for a new workspace. */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantRegistrationService {

    private final UserService userService;
    private final TenantService tenantService;
    private final RegistrationProcessor registrationProcessor;
    private final EmailDomainPolicy emailDomainPolicy;
    private final OrganizationService organizationService;

    public Tenant registerTenant(TenantRegistrationRequest request) {

        registrationProcessor.preProcessTenantRegistration(request);

        String tenantDomain = request.getTenantDomain().toLowerCase(ROOT);
        String userEmail = request.getEmail().toLowerCase(ROOT);

        emailDomainPolicy.ensureEmailAllowed(userEmail);

        if (tenantService.existByDomain(tenantDomain)) {
            throw new IllegalArgumentException("This domain is already in use. Please try a different one.");
        }

        boolean hasActiveUser = userService.existsActiveByEmail(userEmail);

        if (hasActiveUser) {
            throw new IllegalArgumentException("This account already belongs to another tenant.");
        }

        ProvisionedTenant result = provisionTenant(registrationProcessor.reserveTenantIdForRegistration(request), request);
        registrationProcessor.postProcessTenantRegistration(result.getTenant(), result.getOwner(), request);
        return result.getTenant();
    }

    public ProvisionedTenant provisionTenant(String tenantId, TenantRegistrationRequest request) {
        String userEmail = request.getEmail().toLowerCase(ROOT);
        Tenant tenant = tenantService.createTenant(tenantId, request.getTenantName(), request.getTenantDomain().toLowerCase(ROOT));

        // Verified-at-creation when the SSO flow proved the email, so downstream post-processing
        // (e.g. the SaaS verification email) sees the final state rather than racing an update.
        AuthUser user = request.isEmailPreVerified()
                ? userService.registerVerifiedUser(tenant.getId(), userEmail, request.getFirstName(),
                        request.getLastName(), request.getPassword(), List.of(OWNER))
                : userService.registerUser(tenant.getId(), userEmail, request.getFirstName(),
                        request.getLastName(), request.getPassword(), List.of(OWNER));

        tenant.setOwnerId(user.getId());

        Tenant savedTenant = tenantService.save(tenant);

        organizationService.createDefaultOrganization(savedTenant.getId());

        return new ProvisionedTenant(savedTenant, user);
    }

    /** Workspace and owner created together for registration post-processing. */
    @Value
    public static class ProvisionedTenant {
        Tenant tenant;
        AuthUser owner;
    }
}
