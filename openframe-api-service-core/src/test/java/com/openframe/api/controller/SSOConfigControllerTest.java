package com.openframe.api.controller;

import com.openframe.api.dto.SSOConfigRequest;
import com.openframe.api.dto.SSOConfigResponse;
import com.openframe.api.service.SSOConfigService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.AUTH_PASSWORD_LOGIN_TOGGLE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_DELETE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_TOGGLE;
import static com.openframe.data.document.audit.AuditTargetType.SSO_CONFIG;
import static com.openframe.data.document.sso.SSOConfig.OPENFRAME_PROVIDER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SSOConfigControllerTest {

    @Mock private SSOConfigService ssoConfigService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private SSOConfigController controller;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void toggleEnabled_passwordSignInByItsShortName_recordedAsAPasswordSignInToggle() {
        controller.toggleEnabled("openframe", false);

        verify(auditedMethodRunner).runWhenChanged(eq(AUTH_PASSWORD_LOGIN_TOGGLE), eq(SSO_CONFIG), eq(OPENFRAME_PROVIDER),
                eq(Map.of("enabled", false)), any());
    }

    @Test
    void toggleEnabled_ssoProvider_recordedAsAnSsoToggleOfThatProvider() {
        controller.toggleEnabled("google", true);

        verify(auditedMethodRunner).runWhenChanged(eq(SSO_CONFIG_TOGGLE), eq(SSO_CONFIG), eq("google"),
                eq(Map.of("enabled", true)), any());
    }

    @Test
    void deleteConfig_passwordSignIn_recordedAsTurningPasswordSignInBackOn() {
        controller.deleteConfig(OPENFRAME_PROVIDER);

        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        AuditCall call = callCaptor.getValue();
        assertThat(call.action()).isEqualTo(AUTH_PASSWORD_LOGIN_TOGGLE);
        assertThat(call.targetIdBeforeCall().get()).isEqualTo(OPENFRAME_PROVIDER);
        assertThat(call.detailsFromResult().apply(true)).isEqualTo(Map.of("enabled", true));
    }

    @Test
    void deleteConfig_ssoProvider_recordedAsAnSsoDeleteNamedAfterThatProvider() {
        controller.deleteConfig("microsoft");

        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        AuditCall call = callCaptor.getValue();
        assertThat(call.action()).isEqualTo(SSO_CONFIG_DELETE);
        assertThat(call.targetType()).isEqualTo(SSO_CONFIG);
        assertThat(call.targetIdBeforeCall().get()).isEqualTo("microsoft");
        assertThat(call.targetNameOf().apply(true)).isEqualTo("microsoft");
        assertThat(call.compare()).isFalse();
        assertThat(call.storeIf().test(false)).isFalse();
    }

    @Test
    void saveConfig_newProvider_storesTheSettingsItWasSavedWith() {
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        when(ssoConfigService.isNewConfig("microsoft")).thenReturn(true);

        controller.saveConfig("microsoft", request(null, " Example.com "));

        assertThat(capturedCall().detailsFromResult().apply(saved())).containsOnly(
                entry("clientId", "client-1"), entry("msTenantId", "tenant-1"), entry("autoProvisionUsers", false),
                entry("allowedDomains", List.of("example.com")), entry("enabled", true));
    }

    @Test
    void updateConfig_existingProvider_storesNoSettings() {
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        when(ssoConfigService.isNewConfig("microsoft")).thenReturn(false);

        controller.updateConfig("microsoft", request(null, " Example.com "));

        assertThat(capturedCall().detailsFromResult().apply(saved())).isEmpty();
    }

    @Test
    void saveConfig_refused_keepsTheAskedSettingsWithoutEnabled() {
        controller.saveConfig("microsoft", request(true, "gmail.com"));

        assertThat(capturedCall().detailsFromResult().apply(null)).containsOnly(
                entry("clientId", "client-1"), entry("msTenantId", "tenant-1"), entry("autoProvisionUsers", true),
                entry("allowedDomains", List.of("gmail.com")), entry("enabled", null));
    }

    @Test
    void saveConfig_refused_namedByTheProvider() {
        controller.saveConfig("microsoft", request(true, "gmail.com"));

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("microsoft");
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static SSOConfigRequest request(Boolean autoProvisionUsers, String domain) {
        return SSOConfigRequest.builder()
                .clientId("client-1")
                .clientSecret("secret-1")
                .msTenantId("tenant-1")
                .autoProvisionUsers(autoProvisionUsers)
                .allowedDomains(List.of(domain))
                .build();
    }

    private static SSOConfigResponse saved() {
        return SSOConfigResponse.builder()
                .clientId("client-1")
                .clientSecret("secret-1")
                .msTenantId("tenant-1")
                .autoProvisionUsers(false)
                .allowedDomains(List.of("example.com"))
                .enabled(true)
                .build();
    }
}
