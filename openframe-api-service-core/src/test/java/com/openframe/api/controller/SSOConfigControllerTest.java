package com.openframe.api.controller;

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

import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.AUTH_PASSWORD_LOGIN_TOGGLE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_DELETE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_TOGGLE;
import static com.openframe.data.document.audit.AuditTargetType.SSO_CONFIG;
import static com.openframe.data.document.sso.SSOConfig.OPENFRAME_PROVIDER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

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
        assertThat(call.recordsResult().test(false)).isFalse();
    }
}
