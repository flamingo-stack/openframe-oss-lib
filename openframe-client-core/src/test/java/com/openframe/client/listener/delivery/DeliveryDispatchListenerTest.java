package com.openframe.client.listener.delivery;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;
import com.openframe.client.service.delivery.LocalDeliverySink;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.ProcessedCommand;
import com.openframe.data.nats.model.ToolInstallationMessage;
import com.openframe.data.repository.delivery.ProcessedCommandRepository;
import com.openframe.delivery.dispatch.DeliveryDispatchMessage;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryAudience;
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

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verifyNoMoreInteractions;

@ExtendWith(MockitoExtension.class)
class DeliveryDispatchListenerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String TARGET_ID = "fleetmdm-agent";
    private static final String DISPATCH_ID = "d-1";

    @Mock private DeliverySpecRegistry registry;
    @Mock private LocalDeliverySink sink;
    @Mock private DeliveryMetrics metrics;
    @Mock private DeliverySpec<DeliverySeed, DeliveryPayload> spec;
    @Mock private ProcessedCommandRepository processedCommandRepository;

    @Captor private ArgumentCaptor<DeliveryRequest<DeliveryPayload>> requestCaptor;
    @Captor private ArgumentCaptor<ProcessedCommand> processedCommandCaptor;

    private final ObjectMapper objectMapper = new JsonMapper();

    private DeliveryDispatchListener listener;
    private ObjectNode command;

    @BeforeEach
    void setUp() {
        listener = new DeliveryDispatchListener(registry, sink, objectMapper, metrics, processedCommandRepository);
        ToolInstallationMessage message = new ToolInstallationMessage();
        message.setToolAgentId(TARGET_ID);
        message.setDelivery(new DeliveryRef(DeliveryType.TOOL_INSTALLATION, TARGET_ID, DISPATCH_ID));
        command = objectMapper.valueToTree(message);
    }

    @Test
    void onDispatch_commandForEveryMachine_requestForEveryMachineHandedToSink() {
        // setup
        when(processedCommandRepository.existsById(DISPATCH_ID)).thenReturn(false);
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        doReturn(ToolInstallationMessage.class).when(spec).getPayloadClass();

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.EVERY_MACHINE, null, command));

        // verifications
        verify(sink).accept(requestCaptor.capture());
        DeliveryRequest<DeliveryPayload> request = requestCaptor.getValue();
        assertThat(request.isForEveryMachine()).isTrue();
        assertThat(request.getTargetId()).isEqualTo(TARGET_ID);
        verify(metrics).recordDispatchReceived();
        verifyNoMoreInteractions(metrics);
    }

    @Test
    void onDispatch_noMachineId_rejectedAsIncomplete() {
        // execution
        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, null, command));

        // verifications
        verify(metrics).recordDispatchRejected(DeliveryDispatchListener.REJECTED_INCOMPLETE);
        verifyNoInteractions(sink);
    }

    @Test
    void onDispatch_command_requestRebuiltFromDeliveryBlockAndHandedToSink() {
        // setup
        when(processedCommandRepository.existsById(DISPATCH_ID)).thenReturn(false);
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        doReturn(ToolInstallationMessage.class).when(spec).getPayloadClass();

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command));

        // verifications
        verify(sink).accept(requestCaptor.capture());
        DeliveryRequest<DeliveryPayload> request = requestCaptor.getValue();
        assertThat(request.getType()).isEqualTo(DeliveryType.TOOL_INSTALLATION);
        assertThat(request.getTargetId()).isEqualTo(TARGET_ID);
        assertThat(request.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(request.getPayload()).isInstanceOf(ToolInstallationMessage.class);
        assertThat(request.getPayload().getDelivery().getDispatchId()).isEqualTo(DISPATCH_ID);
        assertThat(request.getDueAt()).isNull();
    }

    @Test
    void onDispatch_commandHandled_idSavedWithTheMomentOfHandling() {
        when(processedCommandRepository.existsById(DISPATCH_ID)).thenReturn(false);
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        doReturn(ToolInstallationMessage.class).when(spec).getPayloadClass();
        Instant before = Instant.now();

        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command));

        Instant after = Instant.now();
        verify(processedCommandRepository).save(processedCommandCaptor.capture());
        assertThat(processedCommandCaptor.getValue().getDispatchId()).isEqualTo(DISPATCH_ID);
        assertThat(processedCommandCaptor.getValue().getHandledAt()).isBetween(before, after);
    }

    @Test
    void onDispatch_commandAlreadyHandled_skippedAndCountedAsDuplicate() {
        when(processedCommandRepository.existsById(DISPATCH_ID)).thenReturn(true);

        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command));

        verify(metrics).recordDispatchDuplicate(DeliveryType.TOOL_INSTALLATION);
        verify(processedCommandRepository, never()).save(any());
        verifyNoInteractions(sink, registry);
    }

    @Test
    void onDispatch_sinkFails_commandNotMarkedHandled() {
        when(processedCommandRepository.existsById(DISPATCH_ID)).thenReturn(false);
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        doReturn(ToolInstallationMessage.class).when(spec).getPayloadClass();
        doThrow(new IllegalStateException("mongo away")).when(sink).accept(any());

        assertThatThrownBy(() -> listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("mongo away");
        verify(processedCommandRepository, never()).save(any());
    }

    @Test
    void onDispatch_scheduledCommand_momentCarriedIntoTheRequest() {
        // setup
        Instant dueAt = Instant.parse("2026-11-01T10:00:00Z");
        when(processedCommandRepository.existsById(DISPATCH_ID)).thenReturn(false);
        doReturn(spec).when(registry).require(DeliveryType.TOOL_INSTALLATION);
        doReturn(ToolInstallationMessage.class).when(spec).getPayloadClass();

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command, dueAt));

        // verifications
        verify(sink).accept(requestCaptor.capture());
        assertThat(requestCaptor.getValue().getDueAt()).isEqualTo(dueAt);
    }

    @Test
    void onDispatch_noDeliveryBlock_rejectedAsIncomplete() {
        // setup
        command.remove("delivery");

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command));

        // verifications
        verifyNoInteractions(sink);
        verify(metrics).recordDispatchRejected("incomplete");
    }

    @Test
    void onDispatch_unknownType_rejectedAsIncomplete() {
        // setup
        ((ObjectNode) command.get("delivery")).put("type", "SOMETHING_NEW");

        // execution
        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command));

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
        listener.onDispatch(new DeliveryDispatchMessage(DeliveryAudience.MACHINE, MACHINE_ID, command));

        // verifications
        verifyNoInteractions(sink);
        verify(metrics).recordDispatchRejected("malformed");
    }
}
