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
        String targetTenantId = resolveTargetTenantId(invitation);

        var existing = userService.findActiveByEmail(invitation.getEmail());
        if (existing.isPresent()) {
            AuthUser reuse = handleExistingActiveUser(existing.get(), targetTenantId, invitation, request);
            if (reuse != null) {
                markVerifiedQuietly(reuse);
                acceptInvitation(invitation, reuse, request);
                return reuse;
            }
        }

        AuthUser user = createUserForInvitation(targetTenantId, invitation, request);
        acceptInvitation(invitation, user, request);
        return user;
    }

    private String resolveTargetTenantId(AuthInvitation invitation) {
        if (localTenant) {
            return tenantRepository.findAll().getFirst().getId();
        }
        return invitation.getTenantId();
    }

    /**
     * If user already belongs to target tenant: accept invitation and return existing user.
     * If user belongs to another tenant:
     *   - when switchTenant=true: deactivate and continue (return null to proceed with creation)
     *   - otherwise: throw
     */
    private AuthUser handleExistingActiveUser(AuthUser current,
                                              String targetTenantId,
                                              AuthInvitation invitation,
                                              InvitationRegistrationRequest request) {
        if (targetTenantId.equals(current.getTenantId())) {
            return current;
        }
        if (TRUE.equals(request.getSwitchTenant())) {
            userService.deactivateUser(current);
            userDeactivationProcessor.postProcessDeactivation(current);
            return null;
        }
        throw new UserActiveInAnotherTenantException(invitation.getEmail());
    }

    private AuthUser createUserForInvitation(String targetTenantId,
                                             AuthInvitation invitation,
                                             InvitationRegistrationRequest request) {
        return userService.registerUserFromInvitation(
                targetTenantId,
                invitation.getEmail(),
                request.getFirstName(),
                request.getLastName(),
                request.getPassword(),
                invitation.getRoles()
        );
    }

    private void acceptInvitation(AuthInvitation invitation, AuthUser user, InvitationRegistrationRequest request) {
        invitation.setStatus(ACCEPTED);
        invitationRepository.save(invitation);
        registrationProcessor.postProcessInvitationRegistration(user, invitation.getId(), request);
    }

    private void markVerifiedQuietly(AuthUser user) {
        try {
            userService.markEmailVerified(user.getId());
        } catch (Exception ignored) {
            // Do not block invitation acceptance if verification update fails
        }
    }
}


