package com.openframe.notification.mail.service;

public interface EmailService {
    void sendInvitationEmail(String toEmail, String invitationId);

    void sendPasswordResetEmail(String toEmail, String resetToken);
}


