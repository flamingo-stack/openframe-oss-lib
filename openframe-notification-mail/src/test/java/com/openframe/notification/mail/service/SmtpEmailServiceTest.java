package com.openframe.notification.mail.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class SmtpEmailServiceTest {

    private static final String TO = "ada@acme.com";

    @Mock
    private JavaMailSender mailSender;

    private SmtpEmailService service;

    @BeforeEach
    void setUp() {
        service = new SmtpEmailService(mailSender);
    }

    @Test
    void sendDownloadLinkEmail_smtpProvider_throwsUnsupportedWithoutSending() {
        assertThatThrownBy(() -> service.sendDownloadLinkEmail(TO, "0b9f3c2e-5d1a-4c7e-9f60-2a8d4e1b7c35"))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessage("Download link email via SMTP is not supported; use HubSpot provider");

        verifyNoInteractions(mailSender);
    }
}
