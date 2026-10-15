package com.openframe.management.service;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
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
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientFeatureFlagsServiceTest {

    private static final Map<String, ClientFeatureFlag> FLAGS = Map.of("delivery-tool-installation", new ClientFeatureFlag(true, "1.6.0"));

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
    void process_flagsMovedAndTypeOnTheEngine_rolledOutToEveryMachineThenStored() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.haveFeatureFlagsMoved(FLAGS)).thenReturn(true);

        // execution
        service.process(FLAGS);

        // verifications
        InOrder inOrder = inOrder(deliveryDispatcher, clientConfigurationService);
        inOrder.verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        inOrder.verify(clientConfigurationService).updateFeatureFlags(FLAGS);
        ClientFeatureFlagsDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getFlags()).isEqualTo(FLAGS);
    }

    @Test
    void process_sameFlagsAgain_nothingSentNothingStored() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.haveFeatureFlagsMoved(FLAGS)).thenReturn(false);

        // execution
        service.process(FLAGS);

        // verifications
        verify(deliveryDispatcher, never()).dispatch(any());
        verify(clientConfigurationService, never()).updateFeatureFlags(any());
    }

    @Test
    void process_typeOff_flagsStoredWithoutTheEngine() {
        // setup
        when(clientConfigurationService.haveFeatureFlagsMoved(FLAGS)).thenReturn(true);

        // execution
        service.process(FLAGS);

        // verifications
        verify(clientConfigurationService).updateFeatureFlags(FLAGS);
        verify(deliveryDispatcher, never()).dispatch(any());
    }

    @Test
    void process_handOffFails_flagsNotStoredSoTheNextStartRetries() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.haveFeatureFlagsMoved(FLAGS)).thenReturn(true);
        doThrow(new IllegalStateException("kafka down")).when(deliveryDispatcher).dispatch(any());

        // execution + verifications
        assertThatThrownBy(() -> service.process(FLAGS)).isInstanceOf(IllegalStateException.class);
        verify(clientConfigurationService, never()).updateFeatureFlags(any());
    }

    @Test
    void process_enabledFlagWithoutMinVersion_refusedBeforeAnythingHappens() {
        // setup
        Map<String, ClientFeatureFlag> flags = Map.of("delivery-client-update", new ClientFeatureFlag(true, null));

        // execution + verifications
        assertThatThrownBy(() -> service.process(flags))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("delivery-client-update");
        verifyNoInteractions(clientConfigurationService, deliveryDispatcher);
    }
}
