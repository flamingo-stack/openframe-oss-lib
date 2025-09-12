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

    private void sendPlainText(String toEmail, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
        log.info("Email '{}' sent to {}", subject, toEmail);
    }
}


