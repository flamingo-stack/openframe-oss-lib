package com.openframe.api.service.user;

import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.shared.MutationError;
import com.openframe.api.mapper.InvitationMapper;
import com.openframe.api.mapper.UserMapper;
import com.openframe.api.service.processor.InvitationProcessor;
import com.openframe.api.service.processor.UserProcessor;
import com.openframe.api.service.user.InvitationService.InviteUsersResult;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import com.openframe.data.repository.user.InvitationRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.notification.mail.service.EmailService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** inviteUsers: each email on its own, refusals reported at their index, the rest still sent. */
@ExtendWith(MockitoExtension.class)
class InviteUsersTest {

    @Mock private UserRepository userRepository;
    @Mock private SsoIdentityRepository ssoIdentityRepository;
    @Mock private UserProcessor userProcessor;
    @Mock private EmailService emailService;
    @Mock private InvitationRepository invitationRepository;
    @Mock private InvitationProcessor invitationProcessor;
    @Mock private EmailDomainPolicy emailDomainPolicy;

    private InvitationService invitationService() {
        InvitationMapper mapper = new InvitationMapper();
        ReflectionTestUtils.setField(mapper, "ttl", Duration.ofHours(24));
        UserService userService = new UserService(userRepository, ssoIdentityRepository, new UserMapper(),
                userProcessor, emailService);
        return new InvitationService(invitationRepository, mapper, emailService, userService,
                invitationProcessor, emailDomainPolicy);
    }

    @Test
    @DisplayName("a mixed batch: the valid emails are sent in order, every other one is a userError at its index")
    void mixedBatch() {
        when(invitationRepository.save(any(Invitation.class))).thenAnswer(call -> call.getArgument(0));
        when(userRepository.existsByEmailAndStatus(anyString(), eq(UserStatus.ACTIVE)))
                .thenAnswer(call -> "taken@acme.io".equals(call.getArgument(0)));
        doAnswer(call -> {
            if ("x@blocked.io".equals(call.getArgument(0))) {
                throw new IllegalArgumentException("Email domain blocked.io is not allowed");
            }
            return null;
        }).when(emailDomainPolicy).ensureEmailAllowed(anyString());
        doAnswer(call -> {
            if ("boom@acme.io".equals(call.getArgument(0))) {
                throw new RuntimeException("SMTP down");
            }
            return null;
        }).when(emailService).sendInvitationEmail(anyString(), anyString());

        InviteUsersResult result = invitationService().inviteUsers(List.of(
                " a@acme.io ", "not-an-email", "A@acme.io", "taken@acme.io", "x@blocked.io", "boom@acme.io", "b@acme.io"));

        assertThat(result.invitations()).extracting(InvitationResponse::getEmail)
                .containsExactly("a@acme.io", "b@acme.io");
        assertThat(result.errors()).extracting(MutationError::getField).containsExactly(
                List.of("emails", "1"), List.of("emails", "2"), List.of("emails", "3"), List.of("emails", "4"),
                List.of("emails", "5"));
        assertThat(result.errors()).extracting(MutationError::getMessage).containsExactly(
                "Invalid email format",
                "Listed twice",
                "User with email taken@acme.io already exists in tenant",
                "Email domain blocked.io is not allowed",
                "Could not send the invitation. Please try again.");
    }

    @Test
    @DisplayName("an invalid email never reaches the domain policy or the repository")
    void invalidEmailIsNotSent() {
        InviteUsersResult result = invitationService().inviteUsers(List.of("jane@", ""));

        assertThat(result.invitations()).isEmpty();
        assertThat(result.errors()).hasSize(2);
        verify(emailDomainPolicy, never()).ensureEmailAllowed(anyString());
        verify(invitationRepository, never()).save(any());
    }
}
