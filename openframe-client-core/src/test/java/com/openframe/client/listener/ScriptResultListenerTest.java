package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.RmmResultService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.rmm.model.RmmResultParser;
import com.openframe.data.nats.rmm.model.ScriptResultMessage;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.Message;
import io.nats.client.MessageHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Mirrors {@link CommandResultListenerTest}: a script result is the same wire
 * shape as a command result, so the only difference is the NATS subject
 * ({@code machine.*.script-execution.result}) AND the concrete Java subtype
 * the payload is parsed into ({@link ScriptResultMessage}). The shared
 * {@code RmmResultService} uses that subtype to pick the downstream MessageType.
 */
@ExtendWith(MockitoExtension.class)
class ScriptResultListenerTest {

    private static final String SUBJECT = "machine.*.script-execution.result";

    @Mock
    private Connection natsConnection;
    @Mock
    private Dispatcher dispatcher;
    @Mock
    private RmmResultService rmmResultService;

    private ScriptResultListener listener;

    @BeforeEach
    void setUp() {
        listener = new ScriptResultListener(
                natsConnection,
                new RmmResultParser(new ObjectMapper()),
                rmmResultService,
                new NatsTopicMachineIdExtractor());
    }

    @Test
    @DisplayName("handleMessage: extracts machineId from the subject, deserializes the payload INTO ScriptResultMessage, and relays to RmmResultService")
    void handleMessage_extractsMachineIdDeserializesAndDelegates() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        // Agent serializes snake_case keys — must map onto the camelCase fields.
        String json = "{\"execution_id\":\"exec-1\",\"machine_id\":\"machine-42\","
                + "\"stdout\":\"hey\\n\",\"stderr\":\"\",\"exit_code\":0,"
                + "\"execution_time_ms\":12,\"timed_out\":false}";
        Message message = message("machine.machine-42.script-execution.result", json);

        handler.onMessage(message);

        ArgumentCaptor<ScriptResultMessage> captor = ArgumentCaptor.forClass(ScriptResultMessage.class);
        // Subtype IS the discriminator — service maps ScriptResultMessage → SCRIPT_EXECUTED downstream.
        verify(rmmResultService).processResult(eq("machine-42"), captor.capture());

        ScriptResultMessage delivered = captor.getValue();
        assertThat(delivered).isInstanceOf(ScriptResultMessage.class);
        assertThat(delivered.getExecutionId()).isEqualTo("exec-1");
        assertThat(delivered.getStdout()).isEqualTo("hey\n");
        assertThat(delivered.getExitCode()).isZero();
        assertThat(delivered.getExecutionTimeMs()).isEqualTo(12L);
        assertThat(delivered.getTimedOut()).isFalse();
    }

    @Test
    @DisplayName("handleMessage: ignores unknown JSON fields (forward-compatible wire contract with the agent)")
    void handleMessage_ignoresUnknownFields() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        String json = "{\"execution_id\":\"exec-9\",\"exit_code\":0,\"future\":\"x\",\"another_new\":42}";
        handler.onMessage(message("machine.m1.script-execution.result", json));

        ArgumentCaptor<ScriptResultMessage> captor = ArgumentCaptor.forClass(ScriptResultMessage.class);
        verify(rmmResultService).processResult(eq("m1"), captor.capture());
        assertThat(captor.getValue().getExecutionId()).isEqualTo("exec-9");
    }

    @Test
    @DisplayName("handleMessage: a malformed payload is swallowed and never reaches the service — a bad message must not kill the core-NATS dispatcher thread")
    void handleMessage_swallowsMalformedPayload() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        Message message = message("machine.machine-42.script-execution.result", "not-json");

        assertThatCode(() -> handler.onMessage(message)).doesNotThrowAnyException();
        verifyNoInteractions(rmmResultService);
    }

    @Test
    @DisplayName("handleMessage: an invalid subject (no machineId segment) is swallowed and never reaches the service")
    void handleMessage_swallowsInvalidSubject() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        Message message = message("bogus-subject", "{\"executionId\":\"exec-1\"}");

        assertThatCode(() -> handler.onMessage(message)).doesNotThrowAnyException();
        verifyNoInteractions(rmmResultService);
    }

    private MessageHandler captureSubscribedHandler() {
        when(natsConnection.createDispatcher()).thenReturn(dispatcher);
        listener.subscribeToScriptResults();

        ArgumentCaptor<MessageHandler> handlerCaptor = ArgumentCaptor.forClass(MessageHandler.class);
        verify(dispatcher).subscribe(eq(SUBJECT), handlerCaptor.capture());
        return handlerCaptor.getValue();
    }

    private static Message message(String subject, String payload) {
        Message message = org.mockito.Mockito.mock(Message.class);
        when(message.getSubject()).thenReturn(subject);
        when(message.getData()).thenReturn(payload.getBytes(StandardCharsets.UTF_8));
        return message;
    }
}
