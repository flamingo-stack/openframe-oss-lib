package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.mapper.OpenFrameClientUpdateMessageMapper;
import com.openframe.data.nats.model.OpenFrameClientUpdateMessage;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenFrameClientUpdatePublisherTest {

    private static final String VERSION = "1.5.40";

    @Mock private NatsMessagePublisher natsMessagePublisher;
    @Mock private OpenFrameClientUpdateMessageMapper messageMapper;
    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Captor private ArgumentCaptor<ClientUpdateDeliverySeed> seedCaptor;

    private DeliveryProperties properties;
    private OpenFrameClientUpdatePublisher publisher;
    private OpenFrameClientConfiguration configuration;

    @BeforeEach
    void setUp() {
        properties = new DeliveryProperties();
        publisher = new OpenFrameClientUpdatePublisher(natsMessagePublisher, messageMapper, clientConfigurationService, properties, deliveryDispatcher);
        configuration = OpenFrameClientConfiguration.builder().version(VERSION).build();
    }

    @Test
    void publish_typeOff_broadcastOnTheStreamAndMarkedPublished() {
        // setup
        OpenFrameClientUpdateMessage message = new OpenFrameClientUpdateMessage();
        when(messageMapper.toMessage(configuration)).thenReturn(message);

        // execution
        publisher.publish(configuration);

        // verifications
        verify(natsMessagePublisher).publishPersistent(eq("machine.all.client-update"), eq(message));
        verify(clientConfigurationService).markAsPublished(configuration);
        verifyNoInteractions(deliveryDispatcher);
    }

    @Test
    void publish_typeOnTheEngine_handedOverForEveryMachineAndMarkedPublished() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UPDATE, true);

        // execution
        publisher.publish(configuration);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        ClientUpdateDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getConfiguration()).isSameAs(configuration);
        verify(clientConfigurationService).markAsPublished(configuration);
        verifyNoInteractions(natsMessagePublisher);
    }

    @Test
    void publish_handOffFails_markedNonPublishedForTheScheduler() {
        // setup
        properties.getEnabled().put(DeliveryType.CLIENT_UPDATE, true);
        doThrow(new IllegalStateException("kafka down")).when(deliveryDispatcher).dispatch(any());

        // execution
        publisher.publish(configuration);

        // verifications
        verify(clientConfigurationService).markAsNonPublished(configuration);
        verify(clientConfigurationService, never()).markAsPublished(any());
    }
}
