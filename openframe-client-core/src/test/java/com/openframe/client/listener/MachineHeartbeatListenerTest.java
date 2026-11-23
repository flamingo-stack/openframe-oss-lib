package com.openframe.client.listener;

import com.openframe.client.service.MachineStatusService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.identityconflict.MachineIdentityConflictService;
import io.nats.client.Connection;
import io.nats.client.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineHeartbeatListenerTest {

    private static final String SUBJECT = "machine.m-1.heartbeat";

    @Mock
    private Connection natsConnection;
    @Mock
    private MachineStatusService machineStatusService;
    @Mock
    private NatsTopicMachineIdExtractor machineIdExtractor;
    @Mock
    private MachineIdentityConflictService conflictService;
    @Mock
    private Message message;

    private MachineHeartbeatListener listener;

    @BeforeEach
    void setUp() {
        @SuppressWarnings("unchecked")
        ObjectProvider<MachineIdentityConflictService> conflicts = mock(ObjectProvider.class, CALLS_REAL_METHODS);
        doReturn(conflictService).when(conflicts).getIfAvailable();
        listener = new MachineHeartbeatListener(natsConnection, new JsonMapper(), machineStatusService,
                machineIdExtractor, conflicts);
        when(message.getSubject()).thenReturn(SUBJECT);
        when(machineIdExtractor.extract(SUBJECT)).thenReturn("m-1");
    }

    private void receive(String payload) {
        when(message.getData()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        listener.handleMessage(message);
    }

    @Test
    void handleMessage_heartbeatWithSession_tracksTheSession() {
        // execution
        receive("{\"sessionId\":\"s-1\"}");

        // verifications
        verify(machineStatusService).processHeartbeat(eq("m-1"), any());
        verify(conflictService).onHeartbeat("m-1", "s-1");
    }

    @Test
    void handleMessage_heartbeatOfAnOlderClient_tracksNothing() {
        // execution
        receive("{}");

        // verifications
        verify(machineStatusService).processHeartbeat(eq("m-1"), any());
        verify(conflictService, never()).onHeartbeat(anyString(), anyString());
    }

    @Test
    void handleMessage_unreadablePayload_stillProcessesTheHeartbeat() {
        // execution
        receive("not json");

        // verifications
        verify(machineStatusService).processHeartbeat(eq("m-1"), any());
        verify(conflictService, never()).onHeartbeat(anyString(), anyString());
    }
}
