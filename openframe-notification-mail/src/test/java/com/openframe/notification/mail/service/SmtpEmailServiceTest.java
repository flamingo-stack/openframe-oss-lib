package com.openframe.notification.mail.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SmtpEmailServiceTest {

    private static final String TO = "dillon.bogan@hotmail.com";

    @Mock
    private JavaMailSender mailSender;

    private SmtpEmailService service;

    @BeforeEach
    void setUp() {
        service = new SmtpEmailService(mailSender);
        ReflectionTestUtils.setField(service, "from", "no-reply@flamingo.cx");
        ReflectionTestUtils.setField(service, "linkTemplate", "https://openframe.ai/auth/invite/{id}");
        ReflectionTestUtils.setField(service, "resetLinkTemplate", "https://openframe.ai/auth/password-reset/?token={token}");
        ReflectionTestUtils.setField(service, "verifyLinkTemplate", "https://openframe.ai/auth/verify?token={token}");
    }

    private SimpleMailMessage sent() {
        ArgumentCaptor<SimpleMailMessage> message = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(message.capture());
        return message.getValue();
    }

    @Test
    void theVerificationEmail_carriesTheVerifyLinkWithTheToken() {
        service.sendEmailVerificationEmail(TO, "tok-1");

        SimpleMailMessage message = sent();
        assertThat(message.getFrom()).isEqualTo("no-reply@flamingo.cx");
        assertThat(message.getTo()).containsExactly(TO);
        assertThat(message.getSubject()).isEqualTo("Verify your OpenFrame email");
        assertThat(message.getText()).contains("https://openframe.ai/auth/verify?token=tok-1");
    }

    @Test
    void withoutAVerifyLinkTemplate_theVerificationEmailFailsLoudly() {
        ReflectionTestUtils.setField(service, "verifyLinkTemplate", "");

        assertThatThrownBy(() -> service.sendEmailVerificationEmail(TO, "tok-1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("openframe.email-verify.link-template");
    }

    @Test
    void withoutAnInviteLinkTemplate_theInvitationEmailFailsLoudly() {
        ReflectionTestUtils.setField(service, "linkTemplate", "");

        assertThatThrownBy(() -> service.sendInvitationEmail(TO, "inv-1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("openframe.invitations.link-template");
    }

    @Test
    void withoutAResetLinkTemplate_theResetEmailFailsLoudly() {
        ReflectionTestUtils.setField(service, "resetLinkTemplate", "");

        assertThatThrownBy(() -> service.sendPasswordResetEmail(TO, "tok-1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("openframe.password-reset.link-template");
    }

    @Test
    void withoutAFromAddress_theEmailIsSentWithoutOne() {
        ReflectionTestUtils.setField(service, "from", "");

        service.sendOwnershipTransferEmail(TO);

        assertThat(sent().getFrom()).isNull();
    }

    @Test
    void theResetEmail_carriesTheResetLinkWithTheToken() {
        service.sendPasswordResetEmail(TO, "tok-2");

        SimpleMailMessage message = sent();
        assertThat(message.getFrom()).isEqualTo("no-reply@flamingo.cx");
        assertThat(message.getTo()).containsExactly(TO);
        assertThat(message.getText()).contains("https://openframe.ai/auth/password-reset/?token=tok-2");
    }

    @Test
    void theInvitationEmail_carriesTheInviteLinkWithTheId() {
        service.sendInvitationEmail(TO, "inv-3");

        SimpleMailMessage message = sent();
        assertThat(message.getFrom()).isEqualTo("no-reply@flamingo.cx");
        assertThat(message.getTo()).containsExactly(TO);
        assertThat(message.getText()).contains("https://openframe.ai/auth/invite/inv-3");
    }

    @Test
    void theOwnershipEmail_isSentToTheNewOwner() {
        service.sendOwnershipTransferEmail(TO);

        SimpleMailMessage message = sent();
        assertThat(message.getTo()).containsExactly(TO);
        assertThat(message.getSubject()).contains("owner");
    }

    @Test
    void theDeletionEmail_isSentToTheDeletedAccount() {
        service.sendAccountDeletedEmail(TO);

        SimpleMailMessage message = sent();
        assertThat(message.getTo()).containsExactly(TO);
        assertThat(message.getSubject()).contains("deleted");
    }

}
