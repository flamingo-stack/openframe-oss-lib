package com.openframe.data.nats.rmm.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class ScriptNatsPublisherTest {

    private NatsMessagePublisher messagePublisher;
    private ScriptNatsPublisher publisher;

    @BeforeEach
    void setUp() {
        messagePublisher = mock(NatsMessagePublisher.class);
        publisher = new ScriptNatsPublisher(messagePublisher);
    }

    @Test
    @DisplayName("publishScript: routes to machine.<machineId>.script-execution and forwards the ScriptMessage verbatim")
    void publishScript_routesToMachineSubjectWithUnchangedPayload() {
        ScriptMessage message = ScriptMessage.builder()
                .executionId("exec-1")
                .scriptBody("df -h")
                .build();

        publisher.publishScript("machine-42", message);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<ScriptMessage> body = ArgumentCaptor.forClass(ScriptMessage.class);
        verify(messagePublisher).publish(subject.capture(), body.capture());
        assertThat(subject.getValue()).isEqualTo("machine.machine-42.script-execution");
        // The publisher does not massage the payload — same instance reaches the transport.
        assertThat(body.getValue()).isSameAs(message);
    }

    @Test
    @DisplayName("publishScript: uses core NATS publish, NOT publishPersistent — script dispatch must not be durable / replayable")
    void publishScript_usesCoreNatsNotJetStream() {
        ScriptMessage message = ScriptMessage.builder()
                .executionId("exec-1")
                .scriptBody("ls")
                .build();

        publisher.publishScript("machine-42", message);

        verify(messagePublisher).publish(anyString(), any(ScriptMessage.class));
        verify(messagePublisher, never()).publishPersistent(anyString(), any());
    }

    @Test
    @DisplayName("publishScript: blank machineId is rejected before any broker call")
    void publishScript_rejectsBlankMachineId() {
        ScriptMessage message = ScriptMessage.builder().executionId("exec-1").scriptBody("ls").build();

        assertThatThrownBy(() -> publisher.publishScript("   ", message))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("machineId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishScript: null message is rejected before any broker call")
    void publishScript_rejectsNullMessage() {
        assertThatThrownBy(() -> publisher.publishScript("machine-42", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("executionId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishScript: blank executionId is rejected — correlation id is mandatory")
    void publishScript_rejectsBlankExecutionId() {
        ScriptMessage missingId = ScriptMessage.builder().executionId("   ").scriptBody("ls").build();

        assertThatThrownBy(() -> publisher.publishScript("machine-42", missingId))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("executionId");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publishScript: NatsException from the transport propagates so the GraphQL mutation can surface dispatch failure")
    void publishScript_propagatesTransportFailure() {
        ScriptMessage message = ScriptMessage.builder().executionId("exec-1").scriptBody("ls").build();
        doThrow(new NatsException("broker offline"))
                .when(messagePublisher).publish(anyString(), any(ScriptMessage.class));

        assertThatThrownBy(() -> publisher.publishScript("machine-42", message))
                .isInstanceOf(NatsException.class);
    }
}
