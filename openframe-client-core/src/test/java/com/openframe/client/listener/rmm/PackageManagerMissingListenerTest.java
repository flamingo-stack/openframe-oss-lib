package com.openframe.client.listener.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.PackageManagerBootstrapService;
import com.openframe.data.document.packagesearch.PackageManagerType;
import io.nats.client.Connection;
import io.nats.client.Message;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PackageManagerMissingListenerTest {

    private final PackageManagerBootstrapService bootstrapService = mock(PackageManagerBootstrapService.class);
    private final PackageManagerMissingListener listener = new PackageManagerMissingListener(
            mock(Connection.class), new ObjectMapper(), bootstrapService, new NatsTopicMachineIdExtractor());

    private static Message message(String subject, String payload) {
        Message message = mock(Message.class);
        when(message.getSubject()).thenReturn(subject);
        when(message.getData()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        return message;
    }

    @Test
    @DisplayName("valid report: machineId comes from the subject, dispatch is called, message acked")
    void dispatchesAndAcks() {
        Message message = message("machine.m-42.package-manager-missing", "{\"packageManager\":\"BREW\"}");

        listener.handleMessage(message);

        verify(bootstrapService).dispatchInstall("m-42", PackageManagerType.BREW);
        verify(message).ack();
    }

    @Test
    @DisplayName("unknown manager value: permanently bad, acked without dispatch (no redelivery loop)")
    void acksUnknownManager() {
        Message message = message("machine.m-42.package-manager-missing", "{\"packageManager\":\"APT\"}");

        listener.handleMessage(message);

        verify(bootstrapService, never()).dispatchInstall(anyString(), any());
        verify(message).ack();
    }

    @Test
    @DisplayName("missing manager field: acked without dispatch")
    void acksMissingManager() {
        Message message = message("machine.m-42.package-manager-missing", "{}");

        listener.handleMessage(message);

        verify(bootstrapService, never()).dispatchInstall(anyString(), any());
        verify(message).ack();
    }

    @Test
    @DisplayName("transient service failure: left unacked so JetStream redelivers")
    void leavesUnackedOnServiceFailure() {
        doThrow(new RuntimeException("mongo down")).when(bootstrapService).dispatchInstall(anyString(), any());
        Message message = message("machine.m-42.package-manager-missing", "{\"packageManager\":\"CHOCO\"}");

        listener.handleMessage(message);

        verify(message, never()).ack();
    }
}
