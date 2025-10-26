package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.service.OrganizationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;

import static com.openframe.data.document.user.UserRole.OWNER;

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

        String tenantDomain = request.getTenantDomain().toLowerCase(Locale.ROOT);
        String userEmail = request.getEmail().toLowerCase(Locale.ROOT);

        if (tenantService.existByDomain(tenantDomain)) {
            throw new IllegalArgumentException("Registration is closed for this organization");
        }

        boolean hasActiveUser = userService.findActiveByEmail(userEmail)
                .isPresent();

        if (hasActiveUser) {
            throw new IllegalArgumentException("Registration is closed for this user");
        }

        Tenant tenant = tenantService.createTenant(request.getTenantName(), tenantDomain);

        AuthUser user = userService.registerUser(
                tenant.getId(),
                userEmail,
                request.getFirstName(),
                request.getLastName(),
                request.getPassword(),
                List.of(OWNER)
        );

        tenant.setOwnerId(user.getId());

        Tenant savedTenant = tenantService.save(tenant);

        organizationService.createDefaultOrganization();

        registrationProcessor.postProcessTenantRegistration(savedTenant, user, request);

        return savedTenant;
    }
}