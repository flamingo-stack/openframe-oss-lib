package com.openframe.client.listener.delivery;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.delivery.ClientFeatureFlagsDeliveryService;
import com.openframe.data.repository.device.MachineRepository;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Message;
import io.nats.client.MessageHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClientFeatureFlagsRequestListenerTest {

    private static final String MACHINE_ID = "mach-42";

    @Mock private Connection natsConnection;
    @Mock private Dispatcher dispatcher;
    @Mock private Message message;
    @Mock private MachineRepository machineRepository;
    @Mock private ClientFeatureFlagsDeliveryService deliveryService;

    private ClientFeatureFlagsRequestListener listener;

    @BeforeEach
    void setUp() {
        listener = new ClientFeatureFlagsRequestListener(natsConnection, new NatsTopicMachineIdExtractor(), machineRepository, deliveryService);
    }

    @Test
    void subscribe_everyMachinesRequestsInOneQueueGroup() {
        // setup
        when(natsConnection.createDispatcher()).thenReturn(dispatcher);

        // execution
        listener.subscribe();

        // verifications
        verify(dispatcher).subscribe(eq("machine.*.feature-flags.request"), eq("client-feature-flags-request"), any(MessageHandler.class));
    }

    @Test
    void handleMessage_knownMachine_currentFlagsHandedToIt() {
        // setup
        when(message.getSubject()).thenReturn("machine.mach-42.feature-flags.request");
        when(machineRepository.existsByMachineId(MACHINE_ID)).thenReturn(true);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deliveryService).process(MACHINE_ID);
    }

    @Test
    void handleMessage_unknownMachine_requestDropped() {
        // setup
        when(message.getSubject()).thenReturn("machine.ghost.feature-flags.request");
        when(machineRepository.existsByMachineId("ghost")).thenReturn(false);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(deliveryService);
    }

    @Test
    void handleMessage_subjectWithoutMachineId_requestDroppedWithoutFailing() {
        // setup
        when(message.getSubject()).thenReturn("feature-flags.request");

        // execution + verifications
        assertThatCode(() -> listener.handleMessage(message)).doesNotThrowAnyException();
        verifyNoInteractions(machineRepository, deliveryService);
    }
}
