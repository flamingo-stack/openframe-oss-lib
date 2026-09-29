package com.openframe.client.listener.rmm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.MachinePackageManagersService;
import com.openframe.data.document.packagesearch.PackageManagerState;
import io.nats.client.Connection;
import io.nats.client.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static com.openframe.data.document.packagesearch.PackageManagerState.MISSING;
import static com.openframe.data.document.packagesearch.PackageManagerState.UNSUPPORTED;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachinePackageManagersListenerTest {

    private static final String SUBJECT = "machine.m-42.package-managers";
    private static final String MACHINE_ID = "m-42";
    private static final String FULL_SNAPSHOT =
            "{\"packageManagers\":{\"BREW\":\"UNSUPPORTED\",\"WINGET\":\"UNSUPPORTED\",\"CHOCO\":\"MISSING\"}}";
    private static final Map<String, PackageManagerState> FULL_SNAPSHOT_STATES =
            Map.of("BREW", UNSUPPORTED, "WINGET", UNSUPPORTED, "CHOCO", MISSING);

    @Mock private Connection natsConnection;
    @Mock private MachinePackageManagersService packageManagersService;
    @Mock private Message message;

    private MachinePackageManagersListener listener;

    @BeforeEach
    void setUp() {
        listener = new MachinePackageManagersListener(
                natsConnection, new ObjectMapper(), packageManagersService, new NatsTopicMachineIdExtractor());
    }

    @Test
    void handleMessage_fullSnapshot_appliedAndAcked() {
        // setup
        stubMessage(FULL_SNAPSHOT);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(packageManagersService).apply(MACHINE_ID, FULL_SNAPSHOT_STATES);
        verify(message).ack();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"packageManagers\":{}}"})
    void handleMessage_noEntries_ackedWithoutApply(String payload) {
        // setup
        stubMessage(payload);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(packageManagersService, never()).apply(anyString(), anyMap());
        verify(message).ack();
    }

    @ParameterizedTest
    @ValueSource(strings = {"not json", "{\"packageManagers\":{\"BREW\":\"BANANA\"}}"})
    void handleMessage_malformedPayload_ackedWithoutApply(String payload) {
        // setup
        stubMessage(payload);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(packageManagersService, never()).apply(anyString(), anyMap());
        verify(message).ack();
    }

    @Test
    void handleMessage_serviceFailure_leftUnackedForRedelivery() {
        // setup
        stubMessage(FULL_SNAPSHOT);
        doThrow(new RuntimeException("mongo down")).when(packageManagersService).apply(MACHINE_ID, FULL_SNAPSHOT_STATES);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message, never()).ack();
    }

    private void stubMessage(String payload) {
        when(message.getSubject()).thenReturn(SUBJECT);
        when(message.getData()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
    }
}
