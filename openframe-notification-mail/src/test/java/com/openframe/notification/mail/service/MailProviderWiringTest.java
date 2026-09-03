package com.openframe.notification.mail.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

class MailProviderWiringTest {

    private final JavaMailSender mailSender = Mockito.mock(JavaMailSender.class);

    private ApplicationContextRunner contextRunner() {
        return new ApplicationContextRunner()
                .withBean(JavaMailSender.class, () -> mailSender)
                .withPropertyValues(
                        "openframe.mail.from=no-reply@flamingo.cx",
                        "openframe.mail.hubspot.access-token=token",
                        "openframe.mail.hubspot.base-url=http://localhost:1")
                .withUserConfiguration(HubspotApiEmailService.class, SmtpEmailService.class, RoutingEmailService.class,
                        MailProviderConfigCheck.class);
    }

    @Test
    void withoutAProviderProperty_theSmtpSenderIsTheOneEmailService() {
        contextRunner().run(context -> {
            assertThat(context).doesNotHaveBean(HubspotApiEmailService.class).doesNotHaveBean(RoutingEmailService.class);
            assertThat(context.getBean(EmailService.class)).isInstanceOf(SmtpEmailService.class);
        });
    }

    @Test
    void hubSpotOnly_leavesTheHubSpotSenderAsTheOneEmailService() {
        contextRunner().withPropertyValues("openframe.mail.provider=hubspot-api").run(context -> {
            assertThat(context).doesNotHaveBean(SmtpEmailService.class).doesNotHaveBean(RoutingEmailService.class);
            assertThat(context.getBean(EmailService.class)).isInstanceOf(HubspotApiEmailService.class);
        });
    }

    @Test
    void smtpOnly_leavesTheSmtpSenderAsTheOneEmailService() {
        contextRunner().withPropertyValues("openframe.mail.provider=smtp").run(context -> {
            assertThat(context).doesNotHaveBean(HubspotApiEmailService.class).doesNotHaveBean(RoutingEmailService.class);
            assertThat(context.getBean(EmailService.class)).isInstanceOf(SmtpEmailService.class);
        });
    }

    @Test
    void smtpAsTheOnlyProvider_withTheTestSignupFlag_leavesTheSmtpSenderAsTheOneEmailService() {
        contextRunner().withPropertyValues("openframe.mail.provider=smtp", "openframe.mail.test-signup-provider=smtp")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(RoutingEmailService.class).doesNotHaveBean(HubspotApiEmailService.class);
                    assertThat(context.getBean(EmailService.class)).isInstanceOf(SmtpEmailService.class);
                });
    }

    @Test
    void noProvider_withTheTestSignupFlag_leavesTheSmtpSenderAsTheOneEmailService() {
        contextRunner().withPropertyValues("openframe.mail.test-signup-provider=smtp")
                .run(context -> {
                    assertThat(context).doesNotHaveBean(RoutingEmailService.class).doesNotHaveBean(HubspotApiEmailService.class);
                    assertThat(context.getBean(EmailService.class)).isInstanceOf(SmtpEmailService.class);
                });
    }

    @Test
    void hubSpotWithSmtpForTestSignups_makesTheRouterThePrimaryEmailService_usingTheRegisteredDetector() {
        contextRunner()
                .withPropertyValues("openframe.mail.provider=hubspot-api", "openframe.mail.test-signup-provider=smtp",
                        "openframe.email-verify.link-template=https://openframe.ai/auth/verify?token={token}")
                .withBean(TestRecipientDetector.class, () -> "pavlo@flamingo.cx"::equals)
                .run(context -> {
                    assertThat(context.getBean(EmailService.class)).isInstanceOf(RoutingEmailService.class);

                    context.getBean(EmailService.class).sendEmailVerificationEmail("pavlo@flamingo.cx", "tok");

                    ArgumentCaptor<SimpleMailMessage> message = ArgumentCaptor.forClass(SimpleMailMessage.class);
                    verify(mailSender).send(message.capture());
                    assertThat(message.getValue().getTo()).containsExactly("pavlo@flamingo.cx");
                });
    }

    @Test
    void providerValuesMatchCaseInsensitively_forTheRouter() {
        contextRunner().withBean(TestRecipientDetector.class, () -> "pavlo@flamingo.cx"::equals)
                .withPropertyValues("openframe.mail.provider=HUBSPOT-API", "openframe.mail.test-signup-provider=SMTP")
                .run(context -> assertThat(context.getBean(EmailService.class)).isInstanceOf(RoutingEmailService.class));
    }

    @Test
    void providerValuesMatchCaseInsensitively_forTheSmtpSender() {
        contextRunner().withPropertyValues("openframe.mail.provider=SMTP")
                .run(context -> assertThat(context.getBean(EmailService.class)).isInstanceOf(SmtpEmailService.class));
    }

    @Test
    void aMistypedProvider_failsStartupInsteadOfFallingBackToSmtp() {
        contextRunner().withPropertyValues("openframe.mail.provider=hubspot", "openframe.mail.test-signup-provider=smtp")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().rootCause().hasMessageContaining("openframe.mail.provider"));
    }

    @Test
    void aMistypedTestSignupProvider_failsStartup() {
        contextRunner().withPropertyValues("openframe.mail.provider=hubspot-api", "openframe.mail.test-signup-provider=smpt")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().rootCause().hasMessageContaining("openframe.mail.test-signup-provider"));
    }

    @Test
    void withoutADetectorBean_startupFails() {
        contextRunner()
                .withPropertyValues("openframe.mail.provider=hubspot-api", "openframe.mail.test-signup-provider=smtp")
                .run(context -> assertThat(context).hasFailed()
                        .getFailure().hasMessageContaining("TestRecipientDetector"));
    }
}
