package com.openframe.notification.mail.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class RoutingEmailServiceTest {

    private static final String REAL = "dillon.bogan@hotmail.com";
    private static final String TEST = "pavlo@flamingo.cx";

    @Mock
    private HubspotApiEmailService hubspotEmailService;
    @Mock
    private SmtpEmailService smtpEmailService;

    private RoutingEmailService withDetector(TestRecipientDetector detector) {
        return new RoutingEmailService(hubspotEmailService, smtpEmailService, detector);
    }

    @Test
    void aRealRecipient_getsHubSpotMail() {
        RoutingEmailService service = withDetector(email -> false);

        service.sendEmailVerificationEmail(REAL, "verify-tok");
        service.sendPasswordResetEmail(REAL, "reset-tok");
        service.sendInvitationEmail(REAL, "inv-1");
        service.sendOwnershipTransferEmail(REAL);
        service.sendAccountDeletedEmail(REAL);

        verify(hubspotEmailService).sendEmailVerificationEmail(REAL, "verify-tok");
        verify(hubspotEmailService).sendPasswordResetEmail(REAL, "reset-tok");
        verify(hubspotEmailService).sendInvitationEmail(REAL, "inv-1");
        verify(hubspotEmailService).sendOwnershipTransferEmail(REAL);
        verify(hubspotEmailService).sendAccountDeletedEmail(REAL);
        verifyNoInteractions(smtpEmailService);
    }

    @Test
    void aTestRecipient_getsSmtpMail() {
        RoutingEmailService service = withDetector(TEST::equals);

        service.sendEmailVerificationEmail(TEST, "verify-tok");
        service.sendPasswordResetEmail(TEST, "reset-tok");
        service.sendInvitationEmail(TEST, "inv-1");
        service.sendOwnershipTransferEmail(TEST);
        service.sendAccountDeletedEmail(TEST);

        verify(smtpEmailService).sendEmailVerificationEmail(TEST, "verify-tok");
        verify(smtpEmailService).sendPasswordResetEmail(TEST, "reset-tok");
        verify(smtpEmailService).sendInvitationEmail(TEST, "inv-1");
        verify(smtpEmailService).sendOwnershipTransferEmail(TEST);
        verify(smtpEmailService).sendAccountDeletedEmail(TEST);
        verifyNoInteractions(hubspotEmailService);
    }
}
