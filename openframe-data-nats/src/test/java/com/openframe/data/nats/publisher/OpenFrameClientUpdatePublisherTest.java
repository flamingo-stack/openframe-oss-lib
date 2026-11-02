package com.openframe.data.nats.publisher;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.OpenFrameClientConfigurationService;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpenFrameClientUpdatePublisherTest {

    private static final String VERSION = "1.5.40";

    @Mock private OpenFrameClientConfigurationService clientConfigurationService;
    @Mock private DeliveryRouter deliveryRouter;
    @Captor private ArgumentCaptor<ClientUpdateDeliverySeed> seedCaptor;

    private OpenFrameClientUpdatePublisher publisher;
    private OpenFrameClientConfiguration configuration;

    @BeforeEach
    void setUp() {
        publisher = new OpenFrameClientUpdatePublisher(clientConfigurationService, deliveryRouter);
        configuration = OpenFrameClientConfiguration.builder().version(VERSION).build();
    }

    @Test
    void publish_routeCarriesIt_sentToEveryMachineAndMarkedPublished() {
        // setup
        when(deliveryRouter.dispatch(any())).thenReturn(true);

        // execution
        publisher.publish(configuration);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        ClientUpdateDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getConfiguration()).isSameAs(configuration);
        verify(clientConfigurationService).markAsPublished(configuration);
    }

    @Test
    void publish_noRouteCarriesIt_markedNonPublishedForTheScheduler() {
        // setup
        when(deliveryRouter.dispatch(any())).thenReturn(false);

        // execution
        publisher.publish(configuration);

        // verifications
        verify(clientConfigurationService).markAsNonPublished(configuration);
        verify(clientConfigurationService, never()).markAsPublished(any());
    }

    @Test
    void publish_handOffFails_markedNonPublishedForTheScheduler() {
        // setup
        doThrow(new IllegalStateException("kafka down")).when(deliveryRouter).dispatch(any());

        // execution
        publisher.publish(configuration);

        // verifications
        verify(clientConfigurationService).markAsNonPublished(configuration);
        verify(clientConfigurationService, never()).markAsPublished(any());
    }
}
