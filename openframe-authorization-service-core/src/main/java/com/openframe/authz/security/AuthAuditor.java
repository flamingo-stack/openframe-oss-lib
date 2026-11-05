package com.openframe.authz.security;

import com.openframe.audit.ActionOutcome;
import com.openframe.audit.AuditOutcomeResolver;
import com.openframe.audit.AuditRecorder;
import com.openframe.core.util.Sha256;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.auth.AuthInvitation;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.openframe.authz.util.OidcUserUtils.resolveEmail;
import static com.openframe.data.document.audit.AuditAction.AUTH_EMAIL_VERIFICATION_ACCEPT;
import static com.openframe.data.document.audit.AuditAction.AUTH_EMAIL_VERIFICATION_REQUEST;
import static com.openframe.data.document.audit.AuditAction.AUTH_LOGIN;
import static com.openframe.data.document.audit.AuditAction.AUTH_LOGIN_FAIL;
import static com.openframe.data.document.audit.AuditAction.AUTH_LOGOUT;
import static com.openframe.data.document.audit.AuditAction.AUTH_PASSWORD_CHANGE;
import static com.openframe.data.document.audit.AuditAction.AUTH_PASSWORD_RESET_REQUEST;
import static com.openframe.data.document.audit.AuditAction.INVITATION_ACCEPT;
import static com.openframe.data.document.audit.AuditAction.SSO_IDENTITY_LINK;
import static com.openframe.data.document.audit.AuditAction.TENANT_REGISTER;
import static com.openframe.data.document.audit.AuditAction.USER_CREATE;
import static com.openframe.data.document.audit.AuditAction.USER_TENANT_MOVE;
import static com.openframe.data.document.audit.AuditOutcome.FAILURE;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;

@Slf4j
@Component
@RequiredArgsConstructor
public class AuthAuditor {

    public static final String PASSWORD_PROVIDER = "password";

    private final AuditRecorder auditRecorder;
    private final AuditOutcomeResolver outcomeResolver;

    public void recordLogin(AuthUser user, String provider) {
        safely(() -> recordOnUser(AUTH_LOGIN, user, Map.of("provider", provider)));
    }

    public void recordLogout(AuthUser user, String sessionId) {
        safely(() -> recordOnUser(AUTH_LOGOUT, user, Map.of("sessionId", sessionId)));
    }

    public void recordPasswordResetRequest(AuthUser user) {
        safely(() -> recordOnUser(AUTH_PASSWORD_RESET_REQUEST, user, null));
    }

    public void recordPasswordChange(AuthUser user, int revokedSessions) {
        safely(() -> recordOnUser(AUTH_PASSWORD_CHANGE, user, Map.of("revokedSessions", revokedSessions)));
    }

    public void recordVerificationRequest(AuthUser user) {
        safely(() -> recordOnUser(AUTH_EMAIL_VERIFICATION_REQUEST, user, null));
    }

    public void recordEmailVerified(AuthUser user, String via) {
        safely(() -> recordOnUser(AUTH_EMAIL_VERIFICATION_ACCEPT, user, Map.of("via", via)));
    }

    public void recordProvisioned(AuditAction action, AuthUser user, String via) {
        safely(() -> auditRecorder.record(AuditEntry.builder()
                .action(action)
                .outcome(SUCCESS)
                .targetId(user.getId())
                .targetName(user.getFullName())
                .tenantId(user.getTenantId())
                .details(Map.of("via", via))
                .build()));
    }

    public void recordInvitationAccepted(AuthInvitation invitation, AuthUser user) {
        safely(() -> auditRecorder.record(invitationEntry(invitation, SUCCESS, null), actorOf(user)));
    }

    public void recordInvitationNotAccepted(AuthInvitation invitation, RuntimeException failure) {
        safely(() -> {
            ActionOutcome outcome = outcomeResolver.ofFailure(failure);
            AuditEntry entry = invitationEntry(invitation, outcome.outcome(), outcome.reason());
            auditRecorder.record(entry, auditRecorder.userActor(null, invitation.getEmail(), List.of(),
                    invitation.getTenantId()));
        });
    }

    public void recordIdentityLinked(AuthUser user, String provider) {
        safely(() -> recordOnUser(SSO_IDENTITY_LINK, user, Map.of("provider", provider)));
    }

    public void recordTenantMove(AuthUser user, String targetTenantId) {
        safely(() -> recordOnUser(USER_TENANT_MOVE, user, Map.of("toTenantId", targetTenantId)));
    }

    public void recordTenantRegistered(Tenant tenant, AuthUser owner) {
        safely(() -> auditRecorder.record(AuditEntry.builder()
                .action(TENANT_REGISTER)
                .outcome(SUCCESS)
                .targetId(tenant.getId())
                .targetName(tenant.getName())
                .tenantId(tenant.getId())
                .details(Map.of("domain", tenant.getDomain()))
                .build(), actorOf(owner)));
    }

    public void recordRegistrationRefused(String email, RuntimeException failure) {
        safely(() -> {
            ActionOutcome outcome = outcomeResolver.ofFailure(failure);
            AuditEntry entry = AuditEntry.builder()
                    .action(TENANT_REGISTER)
                    .outcome(outcome.outcome())
                    .reason(outcome.reason())
                    .build();
            auditRecorder.record(entry, auditRecorder.userActor(null, email, List.of(), null));
        });
    }

    public void recordProvisioningFailure(String email, String tenantId, String via, Exception failure) {
        safely(() -> auditRecorder.record(AuditEntry.builder()
                .action(USER_CREATE)
                .outcome(FAILURE)
                .reason(failure.getClass().getSimpleName())
                .tenantId(tenantId)
                .details(Map.of("email", email, "via", via))
                .build()));
    }

    public void recordLoginFailure(String email, String tenantId, String reason, Map<String, Object> details) {
        safely(() -> {
            Map<String, Object> allDetails = new HashMap<>(details);
            if (email != null) {
                allDetails.put("email", email);
            }
            AuditEntry entry = AuditEntry.builder()
                    .action(AUTH_LOGIN_FAIL)
                    .outcome(REFUSED)
                    .reason(reason)
                    .tenantId(tenantId)
                    .details(allDetails)
                    .build();
            auditRecorder.record(entry, auditRecorder.userActor(null, email, List.of(), tenantId));
        });
    }

    public static String emailOf(Authentication authentication) {
        Object principal = authentication.getPrincipal();
        if (principal instanceof OidcUser oidcUser) {
            return resolveEmail(oidcUser);
        }
        String email = principal instanceof UserDetails userDetails
                ? userDetails.getUsername()
                : authentication.getName();
        return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
    }

    public static String providerOf(Authentication authentication) {
        return authentication instanceof OAuth2AuthenticationToken token
                ? token.getAuthorizedClientRegistrationId()
                : PASSWORD_PROVIDER;
    }

    private void recordOnUser(AuditAction action, AuthUser user, Map<String, Object> details) {
        AuditEntry entry = AuditEntry.builder()
                .action(action)
                .outcome(SUCCESS)
                .targetId(user.getId())
                .targetName(user.getFullName())
                .tenantId(user.getTenantId())
                .details(details)
                .build();
        auditRecorder.record(entry, actorOf(user));
    }

    public static void safely(Runnable recording) {
        try {
            recording.run();
        } catch (RuntimeException e) {
            log.error("Sign-in audit event not recorded", e);
        }
    }

    private static AuditEntry invitationEntry(AuthInvitation invitation, AuditOutcome outcome, String reason) {
        return AuditEntry.builder()
                .action(INVITATION_ACCEPT)
                .outcome(outcome)
                .reason(reason)
                .targetId(Sha256.hex(invitation.getId()))
                .targetName(invitation.getEmail())
                .tenantId(invitation.getTenantId())
                .build();
    }

    private AuditActor actorOf(AuthUser user) {
        List<String> roles = UserRole.effective(user.getRoles()).stream().map(UserRole::name).toList();
        return auditRecorder.userActor(user.getId(), user.getEmail(), roles, user.getTenantId());
    }
}
