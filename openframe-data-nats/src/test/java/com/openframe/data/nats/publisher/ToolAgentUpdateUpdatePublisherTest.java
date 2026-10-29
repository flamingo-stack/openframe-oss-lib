package com.openframe.data.nats.publisher;

import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.IntegratedToolAgentService;
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
class ToolAgentUpdateUpdatePublisherTest {

    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";

    @Mock private IntegratedToolAgentService integratedToolAgentService;
    @Mock private DeliveryRouter deliveryRouter;
    @Captor private ArgumentCaptor<ToolUpdateDeliverySeed> seedCaptor;

    private ToolAgentUpdateUpdatePublisher publisher;
    private IntegratedToolAgent toolAgent;

    @BeforeEach
    void setUp() {
        publisher = new ToolAgentUpdateUpdatePublisher(integratedToolAgentService, deliveryRouter);
        toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setVersion("1.2.3");
    }

    @Test
    void publish_routeCarriesIt_sentToEveryMachineAndMarkedPublished() {
        // setup
        when(deliveryRouter.dispatch(any())).thenReturn(true);

        // execution
        publisher.publish(toolAgent);

        // verifications
        verify(deliveryRouter).dispatch(seedCaptor.capture());
        ToolUpdateDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getToolAgent()).isSameAs(toolAgent);
        assertThat(seed.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
        verify(integratedToolAgentService).markAsPublished(toolAgent);
    }

    @Test
    void publish_noRouteCarriesIt_markedNonPublishedForTheScheduler() {
        // setup
        when(deliveryRouter.dispatch(any())).thenReturn(false);

        // execution
        publisher.publish(toolAgent);

        // verifications
        verify(integratedToolAgentService).markAsNonPublished(toolAgent);
        verify(integratedToolAgentService, never()).markAsPublished(any());
    }

    @Test
    void publish_handOffFails_markedNonPublishedForTheScheduler() {
        // setup
        doThrow(new IllegalStateException("kafka down")).when(deliveryRouter).dispatch(any());

        // execution
        publisher.publish(toolAgent);

        // verifications
        verify(integratedToolAgentService).markAsNonPublished(toolAgent);
        verify(integratedToolAgentService, never()).markAsPublished(any());
    }
}
