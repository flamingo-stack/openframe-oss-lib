package com.openframe.notification.mail.service;

import java.util.Map;

public interface EmailService {
    void sendInvitationEmail(String toEmail, String invitationId);

    void sendPasswordResetEmail(String toEmail, String resetToken);

    void sendEmailVerificationEmail(String toEmail, String verifyToken);

    void sendOwnershipTransferEmail(String toEmail);

    void sendAccountDeletedEmail(String toEmail);

    void sendDownloadLinkEmail(String toEmail, String downloadId);

    /** Sends a provider template by id; providers without templates do not support it. */
    default void send(String templateId, String toEmail, String subject, Map<String, Object> properties) {
        throw new UnsupportedOperationException("Templated email is not supported by " + getClass().getSimpleName());
    }
}


