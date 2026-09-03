package com.openframe.notification.mail.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnExpression("'${openframe.mail.provider:smtp}'.equalsIgnoreCase('smtp') || '${openframe.mail.test-signup-provider:}'.equalsIgnoreCase('smtp')")
public class SmtpEmailService implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${openframe.mail.from:}")
    private String from;
    @Value("${openframe.invitations.link-template:}")
    private String linkTemplate;
    @Value("${openframe.password-reset.link-template:}")
    private String resetLinkTemplate;
    @Value("${openframe.email-verify.link-template:}")
    private String verifyLinkTemplate;

    @Override
    public void sendInvitationEmail(String toEmail, String invitationId) {
        Assert.state(StringUtils.hasText(linkTemplate), "openframe.invitations.link-template is not set");
        String link = linkTemplate.replace("{id}", invitationId);
        String subject = "You're invited to OpenFrame";
        String body = "Hello,\n\nYou've been invited. Please use the following link to register: " + link +
                "\n\nIf you did not expect this email, you can ignore it.";
        sendPlainText(toEmail, subject, body);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        Assert.state(StringUtils.hasText(resetLinkTemplate), "openframe.password-reset.link-template is not set");
        String link = resetLinkTemplate.replace("{token}", resetToken);
        String subject = "Reset your OpenFrame password";
        String body = "Hello,\n\nWe received a request to reset your password. Use the link below to proceed: " + link +
                "\n\nIf you did not request this, you can ignore this email.";
        sendPlainText(toEmail, subject, body);
    }

    @Override
    public void sendEmailVerificationEmail(String toEmail, String verifyToken) {
        Assert.state(StringUtils.hasText(verifyLinkTemplate), "openframe.email-verify.link-template is not set");
        String link = verifyLinkTemplate.replace("{token}", verifyToken);
        String subject = "Verify your OpenFrame email";
        String body = "Hello,\n\nPlease confirm your email address using the link below: " + link +
                "\n\nIf you did not sign up, you can ignore this email.";
        sendPlainText(toEmail, subject, body);
    }

    @Override
    public void sendOwnershipTransferEmail(String toEmail) {
        String subject = "You're now the owner of your OpenFrame organization";
        String body = "Hello,\n\nOwnership of your OpenFrame organization has been transferred to you. " +
                "You now have full owner access.";
        sendPlainText(toEmail, subject, body);
    }

    @Override
    public void sendAccountDeletedEmail(String toEmail) {
        String subject = "Your OpenFrame account has been deleted";
        String body = "Hello,\n\nYour OpenFrame account has been deleted. " +
                "If this wasn't expected, please contact your organization's administrator.";
        sendPlainText(toEmail, subject, body);
    }

    private void sendPlainText(String toEmail, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) {
            message.setFrom(from);
        }
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
        log.info("Email '{}' sent to {}", subject, toEmail);
    }
}


