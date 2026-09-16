package com.openframe.client.listener.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.rmm.ScriptExecutionAcknowledgeService;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.track.DeliveryTracker;
import com.openframe.data.nats.rmm.model.ScriptExecutionAcknowledgeMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptExecutionAcknowledgeListenerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String EXECUTION_ID = "exec-1";
    private static final String TOOL_AGENT_ID = "tactical-agent";
    private static final String DISPATCH_ID = "d-1";
    private static final String LEGACY_SCRIPT_ACK =
            "{\"executionId\":\"exec-1\",\"machineId\":\"mach-42\",\"scriptIds\":[\"s1\"]}";
    private static final String TOOL_INSTALLATION_ACK =
            "{\"type\":\"TOOL_INSTALLATION\",\"targetId\":\"tactical-agent\",\"machineId\":\"mach-42\",\"dispatchId\":\"d-1\"}";
    private static final String SCRIPT_SCHEDULE_ACK =
            "{\"type\":\"SCRIPT_SCHEDULE\",\"targetId\":\"exec-1\",\"executionId\":\"exec-1\",\"machineId\":\"mach-42\",\"scriptIds\":[\"s1\"]}";
    private static final String MALFORMED = "not json";

    @Mock private Connection natsConnection;
    @Mock private ScriptExecutionAcknowledgeService acknowledgeService;
    @Mock private DeliveryTracker deliveryTracker;
    @Mock private Message message;

    @Captor private ArgumentCaptor<ScriptExecutionAcknowledgeMessage> ackCaptor;

    private ScriptExecutionAcknowledgeListener listener;

    @BeforeEach
    void setUp() {
        listener = new ScriptExecutionAcknowledgeListener(natsConnection, new ObjectMapper(), acknowledgeService, deliveryTracker);
    }

    @Test
    void handleMessage_legacyScriptAck_scriptServiceOnly() {
        // setup
        stubPayload(LEGACY_SCRIPT_ACK);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(acknowledgeService).acknowledge(ackCaptor.capture());
        assertThat(ackCaptor.getValue().getExecutionId()).isEqualTo(EXECUTION_ID);
        verifyNoInteractions(deliveryTracker);
        verify(message).ack();
    }

    @Test
    void handleMessage_toolInstallationAck_trackerOnly() {
        // setup
        stubPayload(TOOL_INSTALLATION_ACK);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deliveryTracker).acknowledge(DeliveryType.TOOL_INSTALLATION, TOOL_AGENT_ID, MACHINE_ID, DISPATCH_ID);
        verifyNoInteractions(acknowledgeService);
        verify(message).ack();
    }

    @Test
    void handleMessage_scriptScheduleAckWithType_trackerAndScriptService() {
        // setup
        stubPayload(SCRIPT_SCHEDULE_ACK);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(deliveryTracker).acknowledge(DeliveryType.SCRIPT_SCHEDULE, EXECUTION_ID, MACHINE_ID, null);
        verify(acknowledgeService).acknowledge(ackCaptor.capture());
        assertThat(ackCaptor.getValue().getExecutionId()).isEqualTo(EXECUTION_ID);
        verify(message).ack();
    }

    @Test
    void handleMessage_malformedPayload_leftUnacked() {
        // setup
        stubPayload(MALFORMED);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message, never()).ack();
        verifyNoInteractions(acknowledgeService);
        verifyNoInteractions(deliveryTracker);
    }

    private void stubPayload(String json) {
        when(message.getData()).thenReturn(json.getBytes(UTF_8));
    }
}
