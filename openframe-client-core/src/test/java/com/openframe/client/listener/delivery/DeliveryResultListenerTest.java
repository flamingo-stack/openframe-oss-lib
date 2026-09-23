package com.openframe.client.listener.delivery;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.track.DeliveryTracker;
import io.nats.client.Connection;
import io.nats.client.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryResultListenerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String SUBJECT = "machine.mach-42.delivery.result";
    private static final String TOOL_AGENT_ID = "fleetmdm-agent";
    private static final String DISPATCH_ID = "d-1";
    private static final String ERROR = "download failed";
    private static final String ACKED =
            "{\"type\":\"TOOL_INSTALLATION\",\"targetId\":\"fleetmdm-agent\",\"dispatchId\":\"d-1\",\"result\":\"ACKED\"}";
    private static final String DONE =
            "{\"type\":\"TOOL_INSTALLATION\",\"targetId\":\"fleetmdm-agent\",\"dispatchId\":\"d-1\",\"result\":\"DONE\"}";
    private static final String FAILED =
            "{\"type\":\"TOOL_INSTALLATION\",\"targetId\":\"fleetmdm-agent\",\"dispatchId\":\"d-1\",\"result\":\"FAILED\",\"error\":\"download failed\"}";
    private static final String WITHOUT_DISPATCH_ID =
            "{\"type\":\"TOOL_INSTALLATION\",\"targetId\":\"fleetmdm-agent\",\"result\":\"ACKED\"}";
    private static final String UNKNOWN_RESULT =
            "{\"type\":\"TOOL_INSTALLATION\",\"targetId\":\"fleetmdm-agent\",\"dispatchId\":\"d-1\",\"result\":\"RETRYING\"}";
    private static final String UNKNOWN_TYPE =
            "{\"type\":\"HOLOGRAM\",\"targetId\":\"fleetmdm-agent\",\"dispatchId\":\"d-1\",\"result\":\"ACKED\"}";
    private static final String MALFORMED = "not json";

    @Mock private Connection natsConnection;
    @Mock private DeliveryTracker deliveryTracker;
    @Mock private DeliveryMetrics metrics;
    @Mock private Message message;

    private DeliveryResultListener listener;

    @BeforeEach
    void setUp() {
        listener = new DeliveryResultListener(natsConnection, new ObjectMapper(), new NatsTopicMachineIdExtractor(), deliveryTracker, metrics);
    }

    @Test
    void handleMessage_acked_trackerAcknowledgesDispatch() {
        // setup
        stubMessage(ACKED);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deliveryTracker).acknowledge(DeliveryType.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID, DISPATCH_ID);
        verify(message).ack();
    }

    @Test
    void handleMessage_done_trackerCompletesDispatch() {
        // setup
        stubMessage(DONE);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deliveryTracker).complete(DeliveryType.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID, DISPATCH_ID);
        verify(message).ack();
    }

    @Test
    void handleMessage_failed_trackerFailsDispatchWithError() {
        // setup
        stubMessage(FAILED);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deliveryTracker).fail(DeliveryType.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID, DISPATCH_ID, ERROR);
        verify(message).ack();
    }

    @Test
    void handleMessage_withoutDispatchId_rejectedCountedAndAcked() {
        // setup
        stubMessage(WITHOUT_DISPATCH_ID);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(deliveryTracker);
        verify(metrics).recordResultRejected("incomplete");
        verify(message).ack();
    }

    @Test
    void handleMessage_unknownResult_rejectedCountedAndAcked() {
        // setup
        stubMessage(UNKNOWN_RESULT);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(deliveryTracker);
        verify(metrics).recordResultRejected("incomplete");
        verify(message).ack();
    }

    @Test
    void handleMessage_unknownType_rejectedCountedAndAcked() {
        // setup
        stubMessage(UNKNOWN_TYPE);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(deliveryTracker);
        verify(metrics).recordResultRejected("incomplete");
        verify(message).ack();
    }

    @Test
    void handleMessage_malformedPayload_rejectedCountedAndAcked() {
        // setup
        stubMessage(MALFORMED);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(deliveryTracker);
        verify(metrics).recordResultRejected("malformed");
        verify(message).ack();
    }

    @Test
    void handleMessage_trackerThrows_leftUnackedForRedelivery() {
        // setup
        stubMessage(ACKED);
        doThrow(new IllegalStateException("mongo down")).when(deliveryTracker).acknowledge(DeliveryType.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID, DISPATCH_ID);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message, never()).ack();
    }

    private void stubMessage(String json) {
        when(message.getSubject()).thenReturn(SUBJECT);
        when(message.getData()).thenReturn(json.getBytes(UTF_8));
    }
}
