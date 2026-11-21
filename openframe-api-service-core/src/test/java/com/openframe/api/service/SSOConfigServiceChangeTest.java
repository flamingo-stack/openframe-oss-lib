package com.openframe.api.service;

import com.openframe.api.service.processor.SSOConfigProcessor;
import com.openframe.data.document.sso.SSOConfig;
import com.openframe.data.repository.sso.SSOConfigRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static com.openframe.data.document.sso.SSOConfig.OPENFRAME_PROVIDER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SSOConfigServiceChangeTest {

    @Mock private SSOConfigRepository ssoConfigRepository;
    @Mock private SSOConfigProcessor ssoConfigProcessor;
    @InjectMocks private SSOConfigService service;

    @Test
    void toggleEnabled_passwordLoginWithoutItsDocumentTurnedOn_reportsNoChange() {
        when(ssoConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service.toggleEnabled(OPENFRAME_PROVIDER, true)).isFalse();
    }

    @Test
    void toggleEnabled_passwordLoginWithoutItsDocumentTurnedOff_reportsAChange() {
        when(ssoConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service.toggleEnabled(OPENFRAME_PROVIDER, false)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({"true, true, false", "true, false, true", "false, true, true"})
    void toggleEnabled_storedProvider_reportsWhetherTheStateMoved(boolean stored, boolean requested, boolean changed) {
        when(ssoConfigRepository.findByProvider("google")).thenReturn(Optional.of(config("google", stored)));
        when(ssoConfigRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        assertThat(service.toggleEnabled("google", requested)).isEqualTo(changed);
    }

    @Test
    void toggleEnabled_providerNotConfigured_reportsNoChange() {
        assertThat(service.toggleEnabled("google", false)).isFalse();
    }

    @Test
    void deleteConfig_passwordLoginStillOn_reportsNoChange() {
        when(ssoConfigRepository.findByProvider(OPENFRAME_PROVIDER))
                .thenReturn(Optional.of(config(OPENFRAME_PROVIDER, true)));

        assertThat(service.deleteConfig(OPENFRAME_PROVIDER)).isFalse();
    }

    @Test
    void deleteConfig_passwordLoginTurnedOff_reportsTurningItBackOn() {
        when(ssoConfigRepository.findByProvider(OPENFRAME_PROVIDER))
                .thenReturn(Optional.of(config(OPENFRAME_PROVIDER, false)));

        assertThat(service.deleteConfig(OPENFRAME_PROVIDER)).isTrue();
    }

    @Test
    void deleteConfig_storedProvider_reportsAChange() {
        when(ssoConfigRepository.findByProvider("microsoft")).thenReturn(Optional.of(config("microsoft", false)));

        assertThat(service.deleteConfig("microsoft")).isTrue();
    }

    @Test
    void deleteConfig_providerNotConfigured_reportsNoChange() {
        assertThat(service.deleteConfig("microsoft")).isFalse();
    }

    private static SSOConfig config(String provider, boolean enabled) {
        SSOConfig config = new SSOConfig();
        config.setProvider(provider);
        config.setEnabled(enabled);
        return config;
    }
}
