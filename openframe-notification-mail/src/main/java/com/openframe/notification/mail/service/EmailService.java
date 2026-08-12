package com.openframe.notification.mail.service;

public interface EmailService {
    void sendInvitationEmail(String toEmail, String invitationId);

    void sendPasswordResetEmail(String toEmail, String resetToken);

    void sendEmailVerificationEmail(String toEmail, String verifyToken);

    void sendOwnershipTransferEmail(String toEmail);

    void sendAccountDeletedEmail(String toEmail);
}


