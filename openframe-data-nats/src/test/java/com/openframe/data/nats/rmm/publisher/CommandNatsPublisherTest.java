package com.openframe.data.nats.rmm.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.CancelMessage;
import com.openframe.data.nats.rmm.model.CommandMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class CommandNatsPublisherTest {

    private NatsMessagePublisher messagePublisher;
    private CommandNatsPublisher publisher;

    @BeforeEach
    void setUp() {
        messagePublisher = mock(NatsMessagePublisher.class);
        publisher = new CommandNatsPublisher(messagePublisher);
    }

    @Test
    @DisplayName("publishCommand: routes to machine.<machineId>.command-execution and forwards the CommandMessage verbatim")
    void publishCommand_routesToMachineSubjectWithUnchangedPayload() {
        CommandMessage message = CommandMessage.builder()
                .executionId("exec-1")
                .code("df -h")
                .build();

        publisher.publishCommand("machine-42", message);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<CommandMessage> body = ArgumentCaptor.forClass(CommandMessage.class);
        verify(messagePublisher).publish(subject.capture(), body.capture());
        assertThat(subject.getValue()).isEqualTo("machine.machine-42.command-execution");
        // The publisher does not massage the payload — same instance reaches the transport.
        assertThat(body.getValue()).isSameAs(message);
    }

    @Test
    @DisplayName("publishCommand: uses core NATS publish, NOT publishPersistent — ad-hoc commands must not be durable / replayable")
    void publishCommand_usesCoreNatsNotJetStream() {
        CommandMessage message = CommandMessage.builder()
                .executionId("exec-1")
                .code("ls")
                .build();

        publisher.publishCommand("machine-42", message);

        verify(messagePublisher).publish(anyString(), any(CommandMessage.class));
        // Locks in the transport choice: a future "let's add durability" change
        // can't silently flip this back to JetStream without breaking this test.
        verify(messagePublisher, never()).publishPersistent(anyString(), any());
    }

    @Test
    @DisplayName("publishCommand: blank machineId is rejected before any broker call — would otherwise produce malformed subject `machine..command-execution`")
    void publishCommand_rejectsBlankMachineId() {
        CommandMessage message = CommandMessage.builder()
                .executionId("exec-1")
                .code("ls")
                .build();

        assertThatThrownBy(() -> publisher.publishCommand("   ", message))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("machineId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishCommand: a subject-unsafe machineId (NATS wildcard) is rejected before any broker call")
    void publishCommand_rejectsSubjectUnsafeMachineId() {
        CommandMessage message = CommandMessage.builder()
                .executionId("exec-1")
                .code("ls")
                .build();

        assertThatThrownBy(() -> publisher.publishCommand("machine.*", message))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("machineId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishCommand: null message is rejected before any broker call — caller must supply a populated CommandMessage")
    void publishCommand_rejectsNullMessage() {
        assertThatThrownBy(() -> publisher.publishCommand("machine-42", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("executionId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishCommand: blank executionId is rejected — correlation is the whole point of the wire format, a blank id is not recoverable")
    void publishCommand_rejectsBlankExecutionId() {
        CommandMessage missingId = CommandMessage.builder()
                .executionId("   ")
                .code("ls")
                .build();

        assertThatThrownBy(() -> publisher.publishCommand("machine-42", missingId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("executionId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishCommand: NatsException from the transport propagates so the GraphQL mutation can surface dispatch failure")
    void publishCommand_propagatesTransportFailure() {
        CommandMessage message = CommandMessage.builder()
                .executionId("exec-1")
                .code("ls")
                .build();
        doThrow(new NatsException("broker offline"))
                .when(messagePublisher).publish(anyString(), any(CommandMessage.class));

        assertThatThrownBy(() -> publisher.publishCommand("machine-42", message))
                .isInstanceOf(NatsException.class);
    }

    @Test
    @DisplayName("publishCancel: routes to machine.<machineId>.command-cancel — distinct subject from command-execution so the agent can prioritise it")
    void publishCancel_routesToCancelSubject() {
        CancelMessage message = CancelMessage.builder()
                .executionId("exec-abc")
                .build();

        publisher.publishCancel("machine-42", message);

        verify(messagePublisher).publish(eq("machine.machine-42.command-cancel"), any(CancelMessage.class));
    }

    @Test
    @DisplayName("publishCancel: uses core NATS publish, NOT publishPersistent — re-delivering a cancel after a broker restart could fire against an unrelated subsequent execution")
    void publishCancel_usesCoreNatsNotJetStream() {
        CancelMessage message = CancelMessage.builder()
                .executionId("exec-abc")
                .build();

        publisher.publishCancel("machine-42", message);

        verify(messagePublisher).publish(anyString(), any(CancelMessage.class));
        verify(messagePublisher, never()).publishPersistent(anyString(), any());
    }

    @Test
    @DisplayName("publishCancel: blank machineId is rejected before any broker call")
    void publishCancel_rejectsBlankMachineId() {
        CancelMessage message = CancelMessage.builder()
                .executionId("exec-abc")
                .build();

        assertThatThrownBy(() -> publisher.publishCancel("", message))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("machineId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishCancel: null message and blank executionId are both rejected — same invariant as publishCommand")
    void publishCancel_rejectsMissingExecutionId() {
        assertThatThrownBy(() -> publisher.publishCancel("machine-42", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("executionId");

        CancelMessage blank = CancelMessage.builder().executionId("").build();
        assertThatThrownBy(() -> publisher.publishCancel("machine-42", blank))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("executionId");

        verifyNoInteractions(messagePublisher);
    }
}
