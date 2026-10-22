package com.openframe.authz.service.sso;

import com.openframe.authz.dto.Touchpoint;
import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.security.SsoCookieCodec;
import com.openframe.authz.security.SsoTenantRegCookiePayload;
import com.openframe.authz.service.processor.RegistrationProcessor;
import com.openframe.authz.service.validation.RegistrationValidationService;
import com.openframe.authz.service.validation.SsoProviderValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
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

    @Test
    void startRegistration_noAttribution_cookieCarriesNoAttribution() {
        assertThat(cookieAttribution(null)).isNull();
    }

    @Test
    void startRegistration_attributionAtCookieLimit_cookieCarriesItWhole() {
        Touchpoint atLimit = attribution(2048 - REFERRER.length() - LANDING_URL.length());

        assertThat(cookieAttribution(atLimit)).isEqualTo(atLimit);
    }

    @Test
    void startRegistration_attributionFitsOnlyWithoutUrls_dropsReferrerAndLandingUrl() {
        Touchpoint bounded = cookieAttribution(attribution(2048));

        assertThat(bounded).isEqualTo(withoutUrls(2048));
    }

    @Test
    void startRegistration_attributionTooLargeEvenWithoutUrls_dropsIt() {
        Touchpoint bounded = cookieAttribution(attribution(2049));

        assertThat(bounded).isNull();
    }

    private Touchpoint cookieAttribution(Touchpoint attribution) {
        service.startRegistration(new SsoTenantRegistrationInitRequest(
                "a@acme.com", "Acme", "acme", "google", null, false, attribution));
        ArgumentCaptor<SsoTenantRegCookiePayload> payload = ArgumentCaptor.forClass(SsoTenantRegCookiePayload.class);
        verify(ssoCookieCodec).encodeTenant(payload.capture());
        return payload.getValue().attribution();
    }

    private static Touchpoint attribution(int lengthWithoutUrls) {
        return withoutUrls(lengthWithoutUrls).toBuilder()
                .referrer(REFERRER)
                .landingUrl(LANDING_URL)
                .build();
    }

    private static Touchpoint withoutUrls(int length) {
        return Touchpoint.builder()
                .utmSource(UTM_SOURCE)
                .downloadId(DOWNLOAD_ID)
                .utmCampaign("c".repeat(length - UTM_SOURCE.length() - DOWNLOAD_ID.length()))
                .build();
    }
}
