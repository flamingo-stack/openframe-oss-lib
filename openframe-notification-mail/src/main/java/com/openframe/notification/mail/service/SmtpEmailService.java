package com.openframe.notification.mail.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "openframe.mail", name = "provider", havingValue = "smtp", matchIfMissing = true)
public class SmtpEmailService implements EmailService {

    private final JavaMailSender mailSender;

    @Value("${openframe.invitations.link-template:}")
    private String linkTemplate;
    @Value("${openframe.password-reset.link-template:}")
    private String resetLinkTemplate;

    @Override
    public void sendInvitationEmail(String toEmail, String invitationId) {
        String link = linkTemplate.replace("{id}", invitationId);
        String subject = "You're invited to OpenFrame";
        String body = "Hello,\n\nYou've been invited. Please use the following link to register: " + link +
                "\n\nIf you did not expect this email, you can ignore it.";
        sendPlainText(toEmail, subject, body);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        String link = resetLinkTemplate.replace("{token}", resetToken);
        String subject = "Reset your OpenFrame password";
        String body = "Hello,\n\nWe received a request to reset your password. Use the link below to proceed: " + link +
                "\n\nIf you did not request this, you can ignore this email.";
        sendPlainText(toEmail, subject, body);
    }

    @Override
    public void sendEmailVerificationEmail(String toEmail, String verifyToken) {
        throw new UnsupportedOperationException("Email verification via SMTP is not supported; use HubSpot provider");
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
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
        log.info("Email '{}' sent to {}", subject, toEmail);
    }
}


