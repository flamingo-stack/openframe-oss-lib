package com.openframe.client.listener.delivery;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.client.service.delivery.LocalDeliverySink;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.delivery.dispatch.DeliveryDispatchMessage;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class DeliveryDispatchListenerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String DISPATCH_ID = "d-1";

    @Mock private DeliverySpecRegistry registry;
    @Mock private LocalDeliverySink sink;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;

    @Captor private ArgumentCaptor<DeliveryRequest<DeliveryPayload>> requestCaptor;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private DeliveryDispatchListener listener;
    private ObjectNode command;

    @BeforeEach
    void setUp() {
        listener = new DeliveryDispatchListener(registry, sink, objectMapper, metrics);
        ToolInstallationMessage message = new ToolInstallationMessage();
        message.setToolAgentId(TARGET_ID);
        message.setDelivery(new DeliveryRef(DeliveryType.TOOL_INSTALLATION, TARGET_ID, DISPATCH_ID));
        command = objectMapper.valueToTree(message);
    }

    @Test
    void onDispatch_command_requestRebuiltFromDeliveryBlockAndHandedToSink() {
        // setup
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        doReturn(ToolInstallationMessage.class).when(spec).getPayloadClass();

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(MACHINE_ID, command));

        // verifications
        verify(sink).accept(requestCaptor.capture());
        DeliveryRequest<DeliveryPayload> request = requestCaptor.getValue();
        assertThat(request.getType()).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(request.getTargetId()).isEqualTo(TARGET_ID);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload()).isInstanceOf(ToolInstallationMessage.class);
        assertThat(request.getPayload().getDelivery().getDispatchId()).isEqualTo(DISPATCH_ID);
    }

    @Test
    void onDispatch_noDeliveryBlock_rejectedAsIncomplete() {
        // setup
        command.remove("delivery");

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(MACHINE_ID, command));

        // verifications
        verifyNoInteractions(sink);
        verify(metrics).recordDispatchRejected("incomplete");
    }

    @Test
    void onDispatch_unknownType_rejectedAsIncomplete() {
        // setup
        ((ObjectNode) command.get("delivery")).put("type", "SOMETHING_NEW");

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(MACHINE_ID, command));

        // verifications
        verifyNoInteractions(sink);
        verify(metrics).recordDispatchRejected("incomplete");
    }

    @Test
    void onDispatch_commandNotOfThePayloadShape_rejectedAsMalformed() {
        // setup
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        doReturn(ToolInstallationMessage.class).when(spec).getPayloadClass();
        JsonNode notAString = objectMapper.createObjectNode().put("nested", true);
        command.set("toolAgentId", notAString);

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(MACHINE_ID, command));

        // verifications
        verifyNoInteractions(sink);
        verify(metrics).recordDispatchRejected("malformed");
    }
}
