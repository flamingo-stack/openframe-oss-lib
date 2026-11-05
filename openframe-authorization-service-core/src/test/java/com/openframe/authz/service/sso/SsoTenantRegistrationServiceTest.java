package com.openframe.authz.service.sso;

import com.openframe.authz.dto.Touchpoint;
import com.openframe.authz.dto.SsoTenantRegistrationInitRequest;
import com.openframe.authz.dto.Visit;
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
    void startRegistration_attribution_cookieCarriesItAsSent() {
        Touchpoint attribution = Touchpoint.builder()
                .downloadId("0b4c5a52-6f0e-4d7b-9a3e-2f1c8d7e6b5a")
                .lastVisit(Visit.builder().utmSource("google").referrer("https://www.google.com/").build())
                .build();

        assertThat(cookieAttribution(attribution)).isEqualTo(attribution);
    }

    private Touchpoint cookieAttribution(Touchpoint attribution) {
        service.startRegistration(new SsoTenantRegistrationInitRequest(
                "a@acme.com", "Acme", "acme", "google", null, false, attribution));
        ArgumentCaptor<SsoTenantRegCookiePayload> payload = ArgumentCaptor.forClass(SsoTenantRegCookiePayload.class);
        verify(ssoCookieCodec).encodeTenant(payload.capture());
        return payload.getValue().attribution();
    }
}
