package com.openframe.management.service;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.version.ReleaseVersion;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.repository.version.ReleaseVersionRepository;
import com.openframe.data.service.IntegratedToolAgentService;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.spec.DeliveryAudience;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientVersionServiceTest {

    private static final String OLD_VERSION = "1.5.39";
    private static final String NEW_VERSION = "1.5.40";

    @Mock private ReleaseVersionRepository releaseVersionRepository;
    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private IntegratedToolAgentService integratedToolAgentService;
    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Captor private ArgumentCaptor<ClientUpdateDeliverySeed> seedCaptor;

    private DeliveryProperties properties;
    private ClientVersionService service;
    private OpenFrameClientConfiguration configuration;

    @BeforeEach
    void setUp() {
        properties = new DeliveryProperties();
        service = new ClientVersionService(releaseVersionRepository, clientConfigurationService, integratedToolAgentService, properties, deliveryDispatcher);
        configuration = OpenFrameClientConfiguration.builder().version(NEW_VERSION).build();
        ReleaseVersion existing = new ReleaseVersion();
        existing.setVersion(OLD_VERSION);
        when(releaseVersionRepository.findFirstBy()).thenReturn(Optional.of(existing));
        when(releaseVersionRepository.save(any())).thenReturn(existing);
        when(integratedToolAgentService.findByReleaseVersionTrue()).thenReturn(List.of());
    }

    @Test
    void process_versionMovedAndTypeOnTheEngine_updateRolledOutToEveryMachine() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UPDATE, true);
        when(clientConfigurationService.updateVersion(NEW_VERSION)).thenReturn(true);
        when(clientConfigurationService.get()).thenReturn(configuration);

        // execution
        service.process(NEW_VERSION);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        ClientUpdateDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getConfiguration()).isSameAs(configuration);
    }

    @Test
    void process_sameVersionAgain_noRollout() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UPDATE, true);
        when(clientConfigurationService.updateVersion(NEW_VERSION)).thenReturn(false);

        // execution
        service.process(NEW_VERSION);

        // verifications
        verify(deliveryDispatcher, never()).dispatch(any());
    }

    @Test
    void process_typeOff_versionUpdatedWithoutTheEngine() {
        // setup
        when(clientConfigurationService.updateVersion(NEW_VERSION)).thenReturn(true);

        // execution
        service.process(NEW_VERSION);

        // verifications
        verify(clientConfigurationService).updateVersion(NEW_VERSION);
        verify(deliveryDispatcher, never()).dispatch(any());
    }
}
