package com.openframe.authz.service.tenant;

import com.openframe.authz.dto.TenantRegistrationRequest;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.user.UserService;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.openframe.data.document.user.UserRole.OWNER;
import static java.util.Locale.ROOT;

@Slf4j
@Service
@RequiredArgsConstructor
public class TenantRegistrationService {

    private final UserService userService;
    private final TenantService tenantService;
    private final RegistrationProcessor registrationProcessor;

    public Tenant registerTenant(TenantRegistrationRequest request) {

        registrationProcessor.preProcessTenantRegistration(request);

        String tenantDomain = request.getTenantDomain().toLowerCase(ROOT);
        String userEmail = request.getEmail().toLowerCase(ROOT);

        if (tenantService.existByDomain(tenantDomain)) {
            throw new IllegalArgumentException("This domain is already in use. Please try a different one.");
        }

        boolean hasActiveUser = userService.findActiveByEmail(userEmail)
                .isPresent();

        if (hasActiveUser) {
            throw new IllegalArgumentException("This account already belongs to another tenant.");
        }

        String reservedTenantId = registrationProcessor.reserveTenantIdForRegistration(request);
        Tenant tenant = tenantService.createTenant(reservedTenantId, request.getTenantName(), tenantDomain);

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

        registrationProcessor.postProcessTenantRegistration(savedTenant, user, request);

        return savedTenant;
    }
}