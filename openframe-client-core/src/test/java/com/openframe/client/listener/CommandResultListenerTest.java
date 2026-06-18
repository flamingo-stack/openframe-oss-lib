package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.RmmResultService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.data.nats.rmm.model.RmmResultParser;
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

@ExtendWith(MockitoExtension.class)
class CommandResultListenerTest {

    private static final String SUBJECT = "machine.*.command-execution.result";

    @Mock
    private Connection natsConnection;
    @Mock
    private Dispatcher dispatcher;
    @Mock
    private RmmResultService rmmResultService;

    private CommandResultListener listener;

    @BeforeEach
    void setUp() {
        // Real parser (over a real ObjectMapper) + extractor — only the NATS transport
        // and the downstream service are mocked. Locks in the actual deserialization
        // contract that an agent payload would hit.
        listener = new CommandResultListener(
                natsConnection,
                new RmmResultParser(new ObjectMapper()),
                rmmResultService,
                new NatsTopicMachineIdExtractor());
    }

    @Test
    @DisplayName("handleMessage: extracts machineId from the subject, deserializes the payload INTO CommandResultMessage, and delegates to RmmResultService")
    void handleMessage_extractsMachineIdDeserializesAndDelegates() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        // Agent serializes snake_case keys — must map onto the camelCase fields.
        String json = "{\"execution_id\":\"exec-1\",\"machine_id\":\"machine-42\","
                + "\"stdout\":\"hey\\n\",\"stderr\":\"\",\"exit_code\":0,"
                + "\"execution_time_ms\":12,\"timed_out\":false}";
        Message message = message("machine.machine-42.command-execution.result", json);

        handler.onMessage(message);

        ArgumentCaptor<CommandResultMessage> captor = ArgumentCaptor.forClass(CommandResultMessage.class);
        // Service receives the concrete subtype, NOT the bare base — the subtype IS
        // the discriminator the service uses to derive MessageType.COMMAND_EXECUTED.
        verify(rmmResultService).processResult(eq("machine-42"), captor.capture());

        CommandResultMessage delivered = captor.getValue();
        assertThat(delivered).isInstanceOf(CommandResultMessage.class);
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
        handler.onMessage(message("machine.m1.command-execution.result", json));

        ArgumentCaptor<CommandResultMessage> captor = ArgumentCaptor.forClass(CommandResultMessage.class);
        verify(rmmResultService).processResult(eq("m1"), captor.capture());
        assertThat(captor.getValue().getExecutionId()).isEqualTo("exec-9");
    }

    @Test
    @DisplayName("handleMessage: a malformed payload is swallowed and never reaches the service — a bad message must not kill the core-NATS dispatcher thread")
    void handleMessage_swallowsMalformedPayload() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        Message message = message("machine.machine-42.command-execution.result", "not-json");

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
        listener.subscribeToCommandResults();

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
