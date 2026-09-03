package com.openframe.notification.mail.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@Primary
@RequiredArgsConstructor
@ConditionalOnExpression("'${openframe.mail.provider:smtp}'.equalsIgnoreCase('hubspot-api') && '${openframe.mail.test-signup-provider:}'.equalsIgnoreCase('smtp')")
public class RoutingEmailService implements EmailService {

    private final HubspotApiEmailService hubspotEmailService;
    private final SmtpEmailService smtpEmailService;
    private final TestRecipientDetector testRecipientDetector;

    @Override
    public void sendInvitationEmail(String toEmail, String invitationId) {
        senderFor(toEmail).sendInvitationEmail(toEmail, invitationId);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        senderFor(toEmail).sendPasswordResetEmail(toEmail, resetToken);
    }

    @Override
    public void sendEmailVerificationEmail(String toEmail, String verifyToken) {
        senderFor(toEmail).sendEmailVerificationEmail(toEmail, verifyToken);
    }

    @Override
    public void sendOwnershipTransferEmail(String toEmail) {
        senderFor(toEmail).sendOwnershipTransferEmail(toEmail);
    }

    @Override
    public void sendAccountDeletedEmail(String toEmail) {
        senderFor(toEmail).sendAccountDeletedEmail(toEmail);
    }

    private EmailService senderFor(String toEmail) {
        if (testRecipientDetector.isTestRecipient(toEmail)) {
            log.info("Test recipient, sending through SMTP instead of HubSpot: {}", toEmail);
            return smtpEmailService;
        }
        return hubspotEmailService;
    }
}
