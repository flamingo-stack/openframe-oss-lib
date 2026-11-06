package com.openframe.client.listener.rmm;

import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.client.service.rmm.MachinePackageManagersService;
import com.openframe.data.document.packagesearch.PackageManagerState;
import com.openframe.data.nats.rmm.model.MachinePackageManagersMessage;
import io.nats.client.Connection;
import io.nats.client.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static com.openframe.data.document.packagesearch.PackageManagerState.MISSING;
import static com.openframe.data.document.packagesearch.PackageManagerState.UNSUPPORTED;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    private static final String SNAPSHOT_WITH_DEPENDENCY =
            "{\"packageManagers\":{\"BREW\":\"UNSUPPORTED\",\"CHOCO\":\"UNSUPPORTED\",\"WINGET\":\"PRESENT\"},"
                    + "\"dependencies\":[{\"manager\":\"WINGET\",\"name\":\"WINGET_CLIENT_MODULE\",\"state\":\"MISSING\"}]}";

    @Mock private Connection natsConnection;
    @Mock private MachinePackageManagersService packageManagersService;
    @Mock private Message message;
    @Captor private ArgumentCaptor<MachinePackageManagersMessage> reportCaptor;

    private MachinePackageManagersListener listener;

    @BeforeEach
    void setUp() {
        listener = new MachinePackageManagersListener(
                natsConnection, new JsonMapper(), packageManagersService, new NatsTopicMachineIdExtractor());
    }

    @Test
    void handleMessage_fullSnapshot_appliedAndAcked() {
        // setup
        stubMessage(FULL_SNAPSHOT);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(packageManagersService).apply(eq(MACHINE_ID), reportCaptor.capture());
        assertThat(reportCaptor.getValue().getPackageManagers()).isEqualTo(FULL_SNAPSHOT_STATES);
        assertThat(reportCaptor.getValue().getDependencies()).isEmpty();
        verify(message).ack();
    }

    @Test
    void handleMessage_snapshotWithDependency_dependencyPassedAlong() {
        // setup
        stubMessage(SNAPSHOT_WITH_DEPENDENCY);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(packageManagersService).apply(eq(MACHINE_ID), reportCaptor.capture());
        MachinePackageManagersMessage.Dependency dependency = reportCaptor.getValue().getDependencies().getFirst();
        assertThat(dependency.getName()).isEqualTo("WINGET_CLIENT_MODULE");
        assertThat(dependency.getState()).isEqualTo(MISSING);
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
        verify(packageManagersService, never()).apply(anyString(), any());
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
        verify(packageManagersService, never()).apply(anyString(), any());
        verify(message).ack();
    }

    @Test
    void handleMessage_serviceFailure_leftUnackedForRedelivery() {
        // setup
        stubMessage(FULL_SNAPSHOT);
        doThrow(new RuntimeException("mongo down")).when(packageManagersService).apply(eq(MACHINE_ID), any());

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
