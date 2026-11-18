package com.openframe.client.listener.packageadopt;

import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage;
import com.openframe.data.nats.packageadopt.PackageAdoptStatusMessage.State;
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
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageAdoptStatusListenerTest {

    private static final String MACHINE_ID = "mach-42";
    private static final String SUBJECT = "machine.mach-42.package-adopt.status";
    private static final String DONE = """
            {"eventId": "e1", "requestId": "req-1", "machineId": "mach-42", "at": "2026-11-18T10:15:30Z", "state": "DONE"}
            """;
    private static final String FAILED = """
            {"eventId": "e2", "requestId": "req-1", "machineId": "mach-42", "at": "2026-11-18T10:15:30Z", "state": "FAILED",
             "message": "brew install --cask postman: exit 1"}
            """;
    private static final String MALFORMED = "not json";

    @Mock private Connection natsConnection;
    @Mock private PackageAdoptStatusProcessor packageAdoptStatusProcessor;
    @Mock private Message message;

    @Captor private ArgumentCaptor<PackageAdoptStatusMessage> eventCaptor;

    private PackageAdoptStatusListener listener;

    @BeforeEach
    void setUp() {
        listener = new PackageAdoptStatusListener(natsConnection, new JsonMapper(), new NatsTopicMachineIdExtractor(),
                packageAdoptStatusProcessor);
    }

    @Test
    void handleMessage_done_processedForTheMachineOfTheSubjectAndAcked() {
        // setup
        stubMessage(SUBJECT, DONE);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(packageAdoptStatusProcessor).process(eq(MACHINE_ID), eventCaptor.capture());
        assertThat(eventCaptor.getValue())
                .extracting(PackageAdoptStatusMessage::getEventId, PackageAdoptStatusMessage::getRequestId,
                        PackageAdoptStatusMessage::getAt, PackageAdoptStatusMessage::getState,
                        PackageAdoptStatusMessage::getMessage)
                .containsExactly("e1", "req-1", Instant.parse("2026-11-18T10:15:30Z"), State.DONE, null);
        verify(message).ack();
    }

    @Test
    void handleMessage_failed_processedWithTheErrorTextAndAcked() {
        // setup
        stubMessage(SUBJECT, FAILED);

        // execution
        listener.handleMessage(message);

        // verifications
        verify(packageAdoptStatusProcessor).process(eq(MACHINE_ID), eventCaptor.capture());
        assertThat(eventCaptor.getValue())
                .extracting(PackageAdoptStatusMessage::getState, PackageAdoptStatusMessage::getMessage)
                .containsExactly(State.FAILED, "brew install --cask postman: exit 1");
        verify(message).ack();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "{\"requestId\": \"req-1\", \"machineId\": \"mach-42\", \"state\": \"DONE\"}",
            "{\"eventId\": \"e1\", \"machineId\": \"mach-42\", \"state\": \"DONE\"}",
            "{\"eventId\": \"e1\", \"requestId\": \"req-1\", \"state\": \"DONE\"}",
            "{\"eventId\": \"e1\", \"requestId\": \"req-1\", \"machineId\": \"mach-42\"}",
            "{\"eventId\": \"e1\", \"requestId\": \"req-1\", \"machineId\": \"mach-42\", \"state\": \"WAITING\"}",
            "null"
    })
    void handleMessage_idsOrStateMissingOrUnknown_rejectedAndAcked(String incomplete) {
        // setup
        stubMessage(SUBJECT, incomplete);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(packageAdoptStatusProcessor);
        verify(message).ack();
    }

    @Test
    void handleMessage_malformedPayload_rejectedAndAcked() {
        // setup
        stubMessage(SUBJECT, MALFORMED);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(packageAdoptStatusProcessor);
        verify(message).ack();
    }

    @Test
    void handleMessage_subjectWithoutAMachine_rejectedAndAcked() {
        // setup
        stubMessage("package-adopt.status", DONE);

        // execution
        listener.handleMessage(message);

        // verifications
        verifyNoInteractions(packageAdoptStatusProcessor);
        verify(message).ack();
    }

    @Test
    void handleMessage_processingFails_leftUnackedForRedelivery() {
        // setup
        IllegalStateException mongoDown = new IllegalStateException("mongo down");
        stubMessage(SUBJECT, DONE);
        doThrow(mongoDown).when(packageAdoptStatusProcessor).process(eq(MACHINE_ID), any(PackageAdoptStatusMessage.class));

        // execution
        listener.handleMessage(message);

        // verifications
        verify(message, never()).ack();
    }

    private void stubMessage(String subject, String json) {
        when(message.getSubject()).thenReturn(subject);
        when(message.getData()).thenReturn(json.getBytes(UTF_8));
    }
}
