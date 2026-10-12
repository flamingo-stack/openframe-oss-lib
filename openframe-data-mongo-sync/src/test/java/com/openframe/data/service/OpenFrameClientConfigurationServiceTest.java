package com.openframe.data.service;

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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenFrameClientConfigurationServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final Map<String, Boolean> FLAGS = Map.of("delivery-tool-installation", true);

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
    void updateFeatureFlags_documentWithoutFlagsYet_flagsStoredAndReportedMoved() {
        // execution
        boolean moved = service.updateFeatureFlags(FLAGS);

        // verifications
        assertThat(moved).isTrue();
        assertThat(configuration.getFeatureFlags()).isEqualTo(FLAGS);
        verify(repository).save(configuration);
    }

    @Test
    void updateFeatureFlags_sameFlags_nothingSavedNotMoved() {
        // setup
        configuration.setFeatureFlags(Map.of("delivery-tool-installation", true));

        // execution
        boolean moved = service.updateFeatureFlags(FLAGS);

        // verifications
        assertThat(moved).isFalse();
        verify(repository, never()).save(any());
    }

    @Test
    void updateFeatureFlags_oneFlagFlipped_storedAndMoved() {
        // setup
        configuration.setFeatureFlags(Map.of("delivery-tool-installation", false));

        // execution
        boolean moved = service.updateFeatureFlags(FLAGS);

        // verifications
        assertThat(moved).isTrue();
        assertThat(configuration.getFeatureFlags()).containsEntry("delivery-tool-installation", true);
    }
}
