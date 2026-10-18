package com.openframe.data.nats.publisher;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.toolagent.IntegratedToolAgent;
import com.openframe.data.nats.delivery.ToolUpdateDeliverySeed;
import com.openframe.data.nats.mapper.ToolAgentUpdateMessageMapper;
import com.openframe.data.nats.model.ToolAgentUpdateMessage;
import com.openframe.data.service.IntegratedToolAgentService;
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
class ToolAgentUpdateUpdatePublisherTest {

    private static final String TOOL_AGENT_KEY = "fleetmdm-agent";

    @Mock private NatsMessagePublisher natsMessagePublisher;
    @Mock private ToolAgentUpdateMessageMapper messageMapper;
    @Mock private IntegratedToolAgentService integratedToolAgentService;
    @Mock private DeliveryDispatcher deliveryDispatcher;
    @Captor private ArgumentCaptor<ToolUpdateDeliverySeed> seedCaptor;

    private DeliveryProperties properties;
    private ToolAgentUpdateUpdatePublisher publisher;
    private IntegratedToolAgent toolAgent;

    @BeforeEach
    void setUp() {
        properties = new DeliveryProperties();
        publisher = new ToolAgentUpdateUpdatePublisher(natsMessagePublisher, messageMapper, integratedToolAgentService, properties, deliveryDispatcher);
        toolAgent = new IntegratedToolAgent();
        toolAgent.setKey(TOOL_AGENT_KEY);
        toolAgent.setVersion("1.2.3");
    }

    @Test
    void publish_typeOff_broadcastOnTheStreamAndMarkedPublished() {
        // setup
        ToolAgentUpdateMessage message = new ToolAgentUpdateMessage();
        when(messageMapper.toMessage(toolAgent)).thenReturn(message);

        // execution
        publisher.publish(toolAgent);

        // verifications
        verify(natsMessagePublisher).publishPersistent(eq("machine.all.tool.fleetmdm-agent.update"), eq(message));
        verify(integratedToolAgentService).markAsPublished(toolAgent);
        verifyNoInteractions(deliveryDispatcher);
    }

    @Test
    void publish_typeOnTheEngine_handedOverForEveryMachineAndMarkedPublished() {
        // setup
        properties.getEnabled().put(DeliveryType.TOOL_UPDATE, true);

        // execution
        publisher.publish(toolAgent);

        // verifications
        verify(deliveryDispatcher).dispatch(seedCaptor.capture());
        ToolUpdateDeliverySeed seed = seedCaptor.getValue();
        assertThat(seed.getAudience()).isEqualTo(DeliveryAudience.EVERY_MACHINE);
        assertThat(seed.getToolAgent()).isSameAs(toolAgent);
        assertThat(seed.getTargetId()).isEqualTo(TOOL_AGENT_KEY);
        verify(integratedToolAgentService).markAsPublished(toolAgent);
        verifyNoInteractions(natsMessagePublisher);
    }

    @Test
    void publish_handOffFails_markedNonPublishedForTheScheduler() {
        // setup
        properties.getEnabled().put(DeliveryType.TOOL_UPDATE, true);
        doThrow(new IllegalStateException("kafka down")).when(deliveryDispatcher).dispatch(any());

        // execution
        publisher.publish(toolAgent);

        // verifications
        verify(integratedToolAgentService).markAsNonPublished(toolAgent);
        verify(integratedToolAgentService, never()).markAsPublished(any());
    }
}
