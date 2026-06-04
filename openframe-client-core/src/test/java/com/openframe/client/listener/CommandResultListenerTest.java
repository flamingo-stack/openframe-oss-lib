package com.openframe.client.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.CommandResultService;
import com.openframe.client.service.NatsTopicMachineIdExtractor;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
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

    private static final String SUBJECT = "machine.*.command-result";

    @Mock
    private Connection natsConnection;
    @Mock
    private Dispatcher dispatcher;
    @Mock
    private CommandResultService commandResultService;

    private CommandResultListener listener;

    @BeforeEach
    void setUp() {
        // Real ObjectMapper + extractor — only the NATS transport and the downstream service are mocked.
        listener = new CommandResultListener(
                natsConnection,
                new ObjectMapper(),
                commandResultService,
                new NatsTopicMachineIdExtractor());
    }

    @Test
    @DisplayName("handleMessage: extracts machineId from the subject, deserializes the payload, and delegates to CommandResultService")
    void handleMessage_extractsMachineIdDeserializesAndDelegates() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        String json = "{\"executionId\":\"exec-1\",\"status\":\"COMPLETED\",\"result\":\"hey\\n\"}";
        Message message = message("machine.machine-42.command-result", json);

        handler.onMessage(message);

        ArgumentCaptor<CommandResultMessage> captor = ArgumentCaptor.forClass(CommandResultMessage.class);
        verify(commandResultService).processCommandResult(eq("machine-42"), captor.capture());

        CommandResultMessage delivered = captor.getValue();
        assertThat(delivered.getExecutionId()).isEqualTo("exec-1");
        assertThat(delivered.getStatus()).isEqualTo("COMPLETED");
        assertThat(delivered.getResult()).isEqualTo("hey\n");
    }

    @Test
    @DisplayName("handleMessage: ignores unknown JSON fields (forward-compatible wire contract with the agent)")
    void handleMessage_ignoresUnknownFields() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        String json = "{\"executionId\":\"exec-9\",\"status\":\"COMPLETED\",\"result\":\"ok\",\"exitCode\":0,\"future\":\"x\"}";
        handler.onMessage(message("machine.m1.command-result", json));

        ArgumentCaptor<CommandResultMessage> captor = ArgumentCaptor.forClass(CommandResultMessage.class);
        verify(commandResultService).processCommandResult(eq("m1"), captor.capture());
        assertThat(captor.getValue().getExecutionId()).isEqualTo("exec-9");
    }

    @Test
    @DisplayName("handleMessage: a malformed payload is swallowed and never reaches the service — a bad message must not kill the core-NATS dispatcher thread")
    void handleMessage_swallowsMalformedPayload() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        Message message = message("machine.machine-42.command-result", "not-json");

        assertThatCode(() -> handler.onMessage(message)).doesNotThrowAnyException();
        verifyNoInteractions(commandResultService);
    }

    @Test
    @DisplayName("handleMessage: an invalid subject (no machineId segment) is swallowed and never reaches the service")
    void handleMessage_swallowsInvalidSubject() throws Exception {
        MessageHandler handler = captureSubscribedHandler();

        Message message = message("bogus-subject", "{\"executionId\":\"exec-1\"}");

        assertThatCode(() -> handler.onMessage(message)).doesNotThrowAnyException();
        verifyNoInteractions(commandResultService);
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
