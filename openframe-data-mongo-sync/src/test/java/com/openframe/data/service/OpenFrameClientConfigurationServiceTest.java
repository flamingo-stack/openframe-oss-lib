package com.openframe.data.service;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenFrameClientConfigurationServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String FLAG = "delivery-tool-installation";
    private static final Map<String, ClientFeatureFlag> FLAGS = Map.of(FLAG, new ClientFeatureFlag(true, "1.6.0"));

    @Mock private OpenFrameClientConfigurationRepository repository;
    @Mock private TenantIdProvider tenantIdProvider;

    private OpenFrameClientConfigurationService service;
    private OpenFrameClientConfiguration configuration;

    @BeforeEach
    void setUp() {
        service = new OpenFrameClientConfigurationService(repository, tenantIdProvider);
        configuration = OpenFrameClientConfiguration.builder().tenantId(TENANT_ID).version("1.5.40").build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(repository.findByTenantId(TENANT_ID)).thenReturn(Optional.of(configuration));
    }

    @Test
    void haveFeatureFlagsMoved_documentWithoutFlagsYet_moved() {
        // execution + verifications
        assertThat(service.haveFeatureFlagsMoved(FLAGS)).isTrue();
    }

    @Test
    void haveFeatureFlagsMoved_sameFlags_notMoved() {
        // setup
        configuration.setFeatureFlags(Map.of(FLAG, new ClientFeatureFlag(true, "1.6.0")));

        // execution + verifications
        assertThat(service.haveFeatureFlagsMoved(FLAGS)).isFalse();
    }

    @Test
    void haveFeatureFlagsMoved_onlyMinVersionRaised_moved() {
        // setup
        configuration.setFeatureFlags(Map.of(FLAG, new ClientFeatureFlag(true, "1.5.0")));

        // execution + verifications
        assertThat(service.haveFeatureFlagsMoved(FLAGS)).isTrue();
    }

    @Test
    void updateFeatureFlags_flagsStored() {
        // setup
        configuration.setFeatureFlags(Map.of(FLAG, new ClientFeatureFlag(false, null)));

        // execution
        service.updateFeatureFlags(FLAGS);

        // verifications
        assertThat(configuration.getFeatureFlags()).isEqualTo(FLAGS);
        verify(repository).save(configuration);
    }
}
