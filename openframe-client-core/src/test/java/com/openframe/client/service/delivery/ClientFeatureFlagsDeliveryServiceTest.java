package com.openframe.client.service.delivery;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliverySeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientFeatureFlagsDeliveryServiceTest {

    private static final String MACHINE_ID = "mach-42";
    private static final Map<String, Boolean> FLAGS = Map.of("delivery-tool-installation", true);

    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Captor private ArgumentCaptor<DeliverySeed> seedCaptor;

    private DeliveryProperties properties;
    private ClientFeatureFlagsDeliveryService service;

    @BeforeEach
    void setUp() {
        properties = new DeliveryProperties();
        service = new ClientFeatureFlagsDeliveryService(clientConfigurationService, properties, deliveryDispatcher);
    }

    @Test
    void process_typeOnTheEngine_currentFlagsHandedToThatMachine() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.get()).thenReturn(OpenFrameClientConfiguration.builder().featureFlags(FLAGS).build());

        // execution
        service.process(MACHINE_ID);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        ClientFeatureFlagsDeliverySeed seed = (ClientFeatureFlagsDeliverySeed) seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(seed.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(seed.getFlags()).isEqualTo(FLAGS);
    }

    @Test
    void process_configurationWithoutFlagsYet_emptySetHandedOver() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.get()).thenReturn(OpenFrameClientConfiguration.builder().build());

        // execution
        service.process(MACHINE_ID);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        assertThat(((ClientFeatureFlagsDeliverySeed) seedCaptor.getValue()).getFlags()).isEmpty();
    }

    @Test
    void process_typeOff_nothingHappens() {
        // execution
        service.process(MACHINE_ID);

        // verifications
        verifyNoInteractions(clientConfigurationService, deliveryDispatcher);
    }

    @Test
    void process_handOffFails_registrationIsNotFailed() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_FEATURE_FLAGS, true);
        when(clientConfigurationService.get()).thenReturn(OpenFrameClientConfiguration.builder().featureFlags(FLAGS).build());
        doThrow(new IllegalStateException("kafka down")).when(deliveryDispatcher).dispatch(any());

        // execution + verifications
        assertThatCode(() -> service.process(MACHINE_ID)).doesNotThrowAnyException();
    }
}
