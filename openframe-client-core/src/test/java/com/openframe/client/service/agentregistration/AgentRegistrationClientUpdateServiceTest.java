package com.openframe.client.service.agentregistration;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliverySeed;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentRegistrationClientUpdateServiceTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private DeliveryRouter deliveryRouter;
    @Captor private ArgumentCaptor<DeliverySeed> seedCaptor;

    private DeliveryProperties properties;
    private AgentRegistrationClientUpdateService service;

    @BeforeEach
    void setUp() {
        properties = new DeliveryProperties();
        service = new AgentRegistrationClientUpdateService(clientConfigurationService, properties, deliveryRouter);
    }

    @Test
    void process_typeOnTheEngine_currentConfigurationSentToThatMachine() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UPDATE, true);
        OpenFrameClientConfiguration configuration = OpenFrameClientConfiguration.builder().version("1.5.40").build();
        when(clientConfigurationService.get()).thenReturn(configuration);

        // execution
        service.process(MACHINE_ID);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        ClientUpdateDeliverySeed seed = (ClientUpdateDeliverySeed) seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.MACHINE);
        assertThat(seed.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(seed.getConfiguration()).isSameAs(configuration);
    }

    @Test
    void process_typeOff_nothingHappens() {
        // execution
        service.process(MACHINE_ID);

        // verifications
        verifyNoInteractions(clientConfigurationService, deliveryRouter);
    }

    @Test
    void process_handOffFails_registrationIsNotFailed() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UPDATE, true);
        when(clientConfigurationService.get()).thenReturn(OpenFrameClientConfiguration.builder().build());
        doThrow(new IllegalStateException("kafka down")).when(deliveryRouter).dispatch(any());

        // execution + verifications
        assertThatCode(() -> service.process(MACHINE_ID)).doesNotThrowAnyException();
    }
}
