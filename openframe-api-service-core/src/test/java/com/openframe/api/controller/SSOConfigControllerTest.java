package com.openframe.api.controller;

import com.openframe.api.service.SSOConfigService;
import com.openframe.audit.AuditedMethodRunner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.AUTH_PASSWORD_LOGIN_TOGGLE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_DELETE;
import static com.openframe.data.document.audit.AuditAction.SSO_CONFIG_TOGGLE;
import static com.openframe.data.document.audit.AuditTargetType.SSO_CONFIG;
import static com.openframe.data.document.sso.SSOConfig.OPENFRAME_PROVIDER;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SSOConfigControllerTest {

    @Mock private SSOConfigService ssoConfigService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private SSOConfigController controller;

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

        verify(auditedMethodRunner).runWhenChanged(eq(AUTH_PASSWORD_LOGIN_TOGGLE), eq(SSO_CONFIG), eq(OPENFRAME_PROVIDER),
                eq(Map.of("enabled", true)), any());
    }

    @Test
    void deleteConfig_ssoProvider_recordedAsAnSsoDeleteOfThatProvider() {
        controller.deleteConfig("microsoft");

        verify(auditedMethodRunner).runWhenChanged(eq(SSO_CONFIG_DELETE), eq(SSO_CONFIG), eq("microsoft"), eq(Map.of()),
                any());
    }
}
