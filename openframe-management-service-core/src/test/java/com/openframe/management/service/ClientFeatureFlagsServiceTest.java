package com.openframe.management.service;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
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

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientFeatureFlagsServiceTest {

    private static final Map<String, Boolean> FLAGS = Map.of("delivery-tool-installation", true);

    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Captor private ArgumentCaptor<ClientFeatureFlagsDeliverySeed> seedCaptor;

    private DeliveryProperties properties;
    private ClientFeatureFlagsService service;

    @BeforeEach
    void setUp() {
        properties = new DeliveryProperties();
        service = new ClientFeatureFlagsService(clientConfigurationService, properties, deliveryDispatcher);
    }

    @Test
    void process_flagsMovedAndTypeOnTheEngine_flagsRolledOutToEveryMachine() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.updateFeatureFlags(FLAGS)).thenReturn(true);

        // execution
        service.process(FLAGS);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        ClientFeatureFlagsDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getFlags()).isEqualTo(FLAGS);
    }

    @Test
    void process_sameFlagsAgain_noRollout() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.updateFeatureFlags(FLAGS)).thenReturn(false);

        // execution
        service.process(FLAGS);

        // verifications
        verify(deliveryDispatcher, never()).dispatch(any());
    }

    @Test
    void process_typeOff_flagsStoredWithoutTheEngine() {
        // setup
        when(clientConfigurationService.updateFeatureFlags(FLAGS)).thenReturn(true);

        // execution
        service.process(FLAGS);

        // verifications
        verify(clientConfigurationService).updateFeatureFlags(FLAGS);
        verify(deliveryDispatcher, never()).dispatch(any());
    }
}
