package com.openframe.api.service.user;

import com.openframe.api.dto.invitation.CreateInvitationRequest;
import com.openframe.api.dto.shared.MutationError;
import com.openframe.api.mapper.InvitationMapper;
import com.openframe.api.service.processor.InvitationProcessor;
import com.openframe.api.service.user.InvitationService.InviteUsersResult;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditRecorder;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.user.InvitationRepository;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvitationServiceTest {

    private static final Instant EXPIRED_AT = Instant.parse("2020-01-01T00:00:00Z");

    @Mock private InvitationRepository invitationRepository;
    @Mock private InvitationMapper invitationMapper;
    @Mock private EmailService emailService;
    @Mock private UserService userService;
    @Mock private InvitationProcessor invitationProcessor;
    @Mock private EmailDomainPolicy emailDomainPolicy;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Mock private AuditRecorder auditRecorder;
    @InjectMocks private InvitationService invitationService;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void createInvitation_emailWithCapitalsOfAnExistingUser_refusesWithTheLowercaseAddress() {
        when(userService.existsActiveUserByEmail("bob@acme.com")).thenReturn(true);

        assertThatThrownBy(() -> invitationService.createInvitation(
                CreateInvitationRequest.builder().email("Bob@Acme.com").build()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("User with email bob@acme.com already exists in tenant");
    }

    @Test
    void inviteUsers_userWhoJoinedWithTheInvitationStillPending_isRefusedAsAnExistingUser() {
        when(userService.existsActiveUserByEmail("bob@acme.com")).thenReturn(true);
        lenient().when(invitationRepository.findAllByEmailAndStatus("bob@acme.com", InvitationStatus.PENDING))
                .thenReturn(List.of(Invitation.builder().email("bob@acme.com").expiresAt(EXPIRED_AT).build()));
        when(auditedMethodRunner.run(any(AuditCall.class), any()))
                .thenAnswer(call -> call.<AuditedWork<?, ?>>getArgument(1).run());

        InviteUsersResult result = invitationService.inviteUsers(List.of("bob@acme.com"));

        assertThat(result.errors()).extracting(MutationError::getMessage)
                .containsExactly("User with email bob@acme.com already exists in tenant");
        verifyNoInteractions(auditRecorder);
    }

    @Test
    void inviteUsers_alreadyInvitedEmailListedTwice_recordsOneRefusal() {
        when(userService.existsActiveUserByEmail("live@acme.io")).thenReturn(false);
        when(invitationRepository.findAllByEmailAndStatus("live@acme.io", InvitationStatus.PENDING))
                .thenReturn(List.of(Invitation.builder().email("live@acme.io").expiresAt(EXPIRED_AT).build()));

        InviteUsersResult result = invitationService.inviteUsers(List.of("live@acme.io", "Live@acme.io"));

        assertThat(result.errors()).extracting(MutationError::getMessage)
                .containsExactly("Already invited and expired: resend that invitation", "Listed twice");
        verify(auditRecorder).record(any(AuditEntry.class));
    }

    @Test
    void inviteUsers_emailWithCapitals_namesTheEventByTheLowercaseEmail() {
        givenNoUserAndNoOpenInvitation();

        invitationService.inviteUsers(List.of("Bob@Acme.com"));

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("bob@acme.com");
    }

    private void givenNoUserAndNoOpenInvitation() {
        when(userService.existsActiveUserByEmail("bob@acme.com")).thenReturn(false);
        when(invitationRepository.findAllByEmailAndStatus("bob@acme.com", InvitationStatus.PENDING))
                .thenReturn(List.of());
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }
}
