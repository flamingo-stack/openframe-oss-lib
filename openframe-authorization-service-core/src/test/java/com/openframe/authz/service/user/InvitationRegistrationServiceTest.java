package com.openframe.authz.service.user;

import com.openframe.authz.dto.InvitationRegistrationRequest;
import com.openframe.authz.exception.OwnerCannotSwitchTenantException;
import com.openframe.authz.exception.UserActiveInAnotherTenantException;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.processor.UserDeactivationProcessor;
import com.openframe.authz.service.sso.SsoIdentityService;
import com.openframe.authz.service.validation.InvitationValidator;
import com.openframe.data.document.auth.AuthInvitation;
import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.document.user.UserRole;
import com.openframe.data.repository.auth.AuthInvitationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static com.openframe.authz.support.SsoTestFixtures.activeUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvitationRegistrationServiceTest {

    @Mock
    private UserService userService;
    @Mock
    private AuthInvitationRepository invitationRepository;
    @Mock
    private RegistrationProcessor registrationProcessor;
    @Mock
    private UserDeactivationProcessor userDeactivationProcessor;
    @Mock
    private InvitationValidator invitationValidator;
    @Mock
    private SsoIdentityService ssoIdentityService;
    @InjectMocks
    private InvitationRegistrationService service;

    private AuthInvitation invitation;

    @BeforeEach
    void setUp() {
        invitation = AuthInvitation.builder().id("inv-1").tenantId("target").email("invitee@acme.com")
                .roles(List.of(UserRole.ADMIN)).status(InvitationStatus.PENDING).build();
        when(invitationValidator.loadAndEnsureAcceptable("inv-1")).thenReturn(invitation);
    }

    private static InvitationRegistrationRequest request(Boolean switchTenant) {
        return InvitationRegistrationRequest.builder().invitationId("inv-1").firstName("In").lastName("Vitee")
                .password("Str0ng-password!").switchTenant(switchTenant).build();
    }

    @Test
    void shouldCreateVerifiedUserWithInvitationEmailAndRoles() {
        AuthUser created = activeUser("new", "target", "invitee@acme.com");
        when(userService.findActiveByEmail("invitee@acme.com")).thenReturn(Optional.empty());
        when(userService.registerUserFromInvitation("target", "invitee@acme.com", "In", "Vitee", "Str0ng-password!",
                List.of(UserRole.ADMIN))).thenReturn(created);

        assertThat(service.registerByInvitation(request(null))).isSameAs(created);
        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.ACCEPTED);
        verify(invitationRepository).save(invitation);
        verify(registrationProcessor).postProcessInvitationRegistration(any(), any(), any());
    }

    @Test
    void shouldReuseExistingMemberOfTheSameTenant() {
        AuthUser member = activeUser("member", "target", "invitee@acme.com");
        when(userService.findActiveByEmail("invitee@acme.com")).thenReturn(Optional.of(member));

        assertThat(service.registerByInvitation(request(null))).isSameAs(member);
        verify(userService).markEmailVerified("member");
        verify(userService, never()).registerUserFromInvitation(any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldRejectUserActiveInAnotherTenantWithoutSwitch() {
        when(userService.findActiveByEmail("invitee@acme.com")).thenReturn(Optional.of(activeUser("u", "old", "invitee@acme.com")));

        assertThatThrownBy(() -> service.registerByInvitation(request(false)))
                .isInstanceOf(UserActiveInAnotherTenantException.class);
        verify(userService, never()).deactivateUser(any());
        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.PENDING);
    }

    @Test
    void shouldNeverLetOwnerSwitchTenant() {
        AuthUser owner = activeUser("u", "old", "invitee@acme.com");
        owner.setRoles(List.of(UserRole.OWNER));
        when(userService.findActiveByEmail("invitee@acme.com")).thenReturn(Optional.of(owner));

        assertThatThrownBy(() -> service.registerByInvitation(request(true)))
                .isInstanceOf(OwnerCannotSwitchTenantException.class);
        verify(userService, never()).deactivateUser(any());
        verify(ssoIdentityService, never()).removeUserLinks(anyString());
    }

    @Test
    void shouldDeactivateOldMembershipAndDropLinksBeforeCreatingNewUser() {
        AuthUser old = activeUser("old-user", "old", "invitee@acme.com");
        when(userService.findActiveByEmail("invitee@acme.com")).thenReturn(Optional.of(old));
        when(userService.registerUserFromInvitation(any(), any(), any(), any(), any(), any()))
                .thenReturn(activeUser("new-user", "target", "invitee@acme.com"));

        service.registerByInvitation(request(true));

        InOrder order = inOrder(userService, ssoIdentityService, userDeactivationProcessor);
        order.verify(userService).deactivateUser(old);
        order.verify(ssoIdentityService).removeUserLinks("old-user");
        order.verify(userDeactivationProcessor).postProcessDeactivation(old);
        order.verify(userService).registerUserFromInvitation(any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldAbortSwitchWhenLinkRemovalFails() {
        when(userService.findActiveByEmail("invitee@acme.com")).thenReturn(Optional.of(activeUser("old-user", "old", "invitee@acme.com")));
        doThrow(new IllegalStateException("mongo")).when(ssoIdentityService).removeUserLinks("old-user");

        assertThatThrownBy(() -> service.registerByInvitation(request(true))).isInstanceOf(IllegalStateException.class);
        verify(userService, never()).registerUserFromInvitation(any(), any(), any(), any(), any(), any());
        assertThat(invitation.getStatus()).isEqualTo(InvitationStatus.PENDING);
    }

    @Test
    void shouldTreatOnlyUnknownEmailInTargetTenantAsNewMember() {
        when(userService.findActiveByEmailAndTenant("invitee@acme.com", "target")).thenReturn(Optional.empty());
        assertThat(service.isNewMemberJoin("inv-1")).isTrue();

        when(userService.findActiveByEmailAndTenant("invitee@acme.com", "target"))
                .thenReturn(Optional.of(activeUser("m", "target", "invitee@acme.com")));
        assertThat(service.isNewMemberJoin("inv-1")).isFalse();
    }
}
