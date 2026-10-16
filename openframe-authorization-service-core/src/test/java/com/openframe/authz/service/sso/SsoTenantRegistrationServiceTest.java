package com.openframe.authz.service.sso;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.openframe.authz.dto.RegistrationAttribution;
import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoTenantRegCookiePayload;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.validation.RegistrationValidationService;
import com.openframe.authz.service.validation.SsoProviderValidator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.LoggerFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SsoTenantRegistrationServiceTest {

    private static final String UTM_SOURCE = "google";
    private static final String DOWNLOAD_ID = "0b4c5a52-6f0e-4d7b-9a3e-2f1c8d7e6b5a";
    private static final String REFERRER = "https://www.google.com/";
    private static final String LANDING_URL = "https://openframe.ai/pricing";

    @Mock
    private SsoCookieCodec ssoCookieCodec;
    @Mock
    private RegistrationValidationService validationService;
    @Mock
    private SsoProviderValidator ssoProviderValidator;
    @Mock
    private RegistrationProcessor registrationProcessor;

    @InjectMocks
    private SsoTenantRegistrationService service;

    private final Logger logger = (Logger) LoggerFactory.getLogger(SsoTenantRegistrationService.class);

    @AfterEach
    void resetLogger() {
        logger.detachAndStopAllAppenders();
        logger.setLevel(null);
    }

    @Test
    void startRegistration_noAttribution_cookieCarriesNoAttribution() {
        assertThat(cookieAttribution(null)).isNull();
    }

    @Test
    void startRegistration_attributionAtCookieLimit_cookieCarriesItWhole() {
        RegistrationAttribution atLimit = attribution(2048 - REFERRER.length() - LANDING_URL.length());

        assertThat(cookieAttribution(atLimit)).isEqualTo(atLimit);
    }

    @Test
    void startRegistration_attributionFitsOnlyWithoutUrls_dropsReferrerAndLandingUrlAndWarns() {
        ListAppender<ILoggingEvent> logs = captureWarnings();

        RegistrationAttribution bounded = cookieAttribution(attribution(2048));

        assertThat(bounded).isEqualTo(withoutUrls(2048));
        assertThat(logs.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getFormattedMessage)
                .containsExactly(tuple(Level.WARN,
                        "Attribution too large for the SSO cookie (2099 chars) — dropping its referrer and landing URL"));
    }

    @Test
    void startRegistration_attributionTooLargeEvenWithoutUrls_dropsItAndWarns() {
        ListAppender<ILoggingEvent> logs = captureWarnings();

        RegistrationAttribution bounded = cookieAttribution(attribution(2049));

        assertThat(bounded).isNull();
        assertThat(logs.list)
                .extracting(ILoggingEvent::getLevel, ILoggingEvent::getFormattedMessage)
                .containsExactly(tuple(Level.WARN, "Attribution too large for the SSO cookie (2100 chars) — dropping it"));
    }

    private RegistrationAttribution cookieAttribution(RegistrationAttribution attribution) {
        service.startRegistration(new SsoTenantRegistrationInitRequest(
                "a@acme.com", "Acme", "acme", "google", null, false, attribution));
        ArgumentCaptor<SsoTenantRegCookiePayload> payload = ArgumentCaptor.forClass(SsoTenantRegCookiePayload.class);
        verify(ssoCookieCodec).encodeTenant(payload.capture());
        return payload.getValue().attribution();
    }

    private ListAppender<ILoggingEvent> captureWarnings() {
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        logger.setLevel(Level.WARN);
        return appender;
    }

    private static RegistrationAttribution attribution(int lengthWithoutUrls) {
        return withoutUrls(lengthWithoutUrls).toBuilder()
                .referrer(REFERRER)
                .landingUrl(LANDING_URL)
                .build();
    }

    private static RegistrationAttribution withoutUrls(int length) {
        return RegistrationAttribution.builder()
                .utmSource(UTM_SOURCE)
                .downloadId(DOWNLOAD_ID)
                .utmCampaign("c".repeat(length - UTM_SOURCE.length() - DOWNLOAD_ID.length()))
                .build();
    }
}
