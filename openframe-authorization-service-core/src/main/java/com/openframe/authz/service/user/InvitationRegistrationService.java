package com.openframe.authz.service.user;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.exception.UserActiveInAnotherTenantException;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.processor.UserDeactivationProcessor;
import com.openframe.authz.service.validation.InvitationValidator;
import com.openframe.data.document.auth.AuthInvitation;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.repository.auth.AuthInvitationRepository;
import com.openframe.data.repository.tenant.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import static com.openframe.data.document.user.InvitationStatus.ACCEPTED;
import static java.lang.Boolean.TRUE;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvitationRegistrationService {

    private final UserService userService;
    private final AuthInvitationRepository invitationRepository;
    private final TenantRepository tenantRepository;
    private final RegistrationProcessor registrationProcessor;
    private final UserDeactivationProcessor userDeactivationProcessor;
    private final InvitationValidator invitationValidator;

    @Value("${openframe.tenancy.local-tenant:false}")
    private boolean localTenant;

    public AuthUser registerByInvitation(InvitationRegistrationRequest request) {
        AuthInvitation invitation = invitationValidator.loadAndEnsureAcceptable(request.getInvitationId());

        var existing = userService.findActiveByEmail(invitation.getEmail());
        if (existing.isPresent()) {
            if (TRUE.equals(request.getSwitchTenant())) {
                userService.deactivateUser(existing.get());
                userDeactivationProcessor.postProcessDeactivation(existing.get());
            } else {
                throw new UserActiveInAnotherTenantException(invitation.getEmail());
            }
        }

        String tenantId = invitation.getTenantId();
        if (localTenant) {
            tenantId = tenantRepository.findAll().getFirst().getId();
        }

        AuthUser user = userService.registerUser(
                tenantId,
                invitation.getEmail(),
                request.getFirstName(),
                request.getLastName(),
                request.getPassword(),
                invitation.getRoles()
        );

        invitation.setStatus(ACCEPTED);
        invitationRepository.save(invitation);

        registrationProcessor.postProcessInvitationRegistration(user, invitation.getId(), request);

        return user;
    }
}


