package com.openframe.data.nats.rmm.publisher;

import com.openframe.core.exception.NatsException;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class ScriptScheduleExecutionNatsPublisherTest {

    private NatsMessagePublisher messagePublisher;
    private ScriptScheduleExecutionNatsPublisher publisher;

    @BeforeEach
    void setUp() {
        messagePublisher = mock(NatsMessagePublisher.class);
        publisher = new ScriptScheduleExecutionNatsPublisher(messagePublisher);
    }

    @Test
    @DisplayName("publish: routes to machine.<machineId>.script-schedule-execution and forwards the batched payload verbatim")
    void publish_routesToMachineSubjectWithUnchangedPayload() {
        ScriptScheduleExecutionMessage message = ScriptScheduleExecutionMessage.builder()
                .executionId("exec-1")
                .scheduleId("sched-1")
                .machineId("machine-42")
                .initiatedBy("cron")
                .scripts(List.of(
                        ScriptScheduleExecutionItem.builder()
                                .scriptId("s1").code("df -h")
                                .shell(ScriptShell.BASH).privilegeLevel(PrivilegeLevel.ADMIN)
                                .build(),
                        ScriptScheduleExecutionItem.builder()
                                .scriptId("s2").code("Get-Process")
                                .shell(ScriptShell.POWERSHELL).privilegeLevel(PrivilegeLevel.USER)
                                .build()))
                .build();

        publisher.publish("machine-42", message);

        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<ScriptScheduleExecutionMessage> body =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(messagePublisher).publish(subject.capture(), body.capture());
        assertThat(subject.getValue()).isEqualTo("machine.machine-42.script-schedule-execution");
        // Same instance reaches the transport — publisher does not repackage the payload.
        assertThat(body.getValue()).isSameAs(message);
    }

    @Test
    @DisplayName("publish: uses core NATS publish, NOT publishPersistent — schedule fires must not be durable / replayable")
    void publish_usesCoreNatsNotJetStream() {
        ScriptScheduleExecutionMessage message = ScriptScheduleExecutionMessage.builder()
                .executionId("exec-1").scheduleId("sched-1").machineId("machine-42")
                .scripts(List.of(ScriptScheduleExecutionItem.builder().scriptId("s1").code("ls")
                        .shell(ScriptShell.BASH).privilegeLevel(PrivilegeLevel.USER).build()))
                .build();

        publisher.publish("machine-42", message);

        verify(messagePublisher).publish(anyString(), any(ScriptScheduleExecutionMessage.class));
        // Locks in the transport choice: a future "let's add durability" change
        // can't silently flip this back to JetStream without breaking this test.
        verify(messagePublisher, never()).publishPersistent(anyString(), any());
    }

    @Test
    @DisplayName("publish: null message is rejected before any broker call")
    void publish_rejectsNullMessage() {
        assertThatThrownBy(() -> publisher.publish("machine-42", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ScriptScheduleExecutionMessage");
        verifyNoInteractions(messagePublisher);
    }

    @Test
    @DisplayName("publish: NatsException from the transport propagates so the caller can surface dispatch failure")
    void publish_propagatesTransportFailure() {
        ScriptScheduleExecutionMessage message = ScriptScheduleExecutionMessage.builder()
                .executionId("exec-1").scheduleId("sched-1").machineId("machine-42")
                .scripts(List.of(ScriptScheduleExecutionItem.builder().scriptId("s1").code("ls")
                        .shell(ScriptShell.BASH).privilegeLevel(PrivilegeLevel.USER).build()))
                .build();
        doThrow(new NatsException("broker offline"))
                .when(messagePublisher).publish(anyString(), any(ScriptScheduleExecutionMessage.class));

        assertThatThrownBy(() -> publisher.publish("machine-42", message))
                .isInstanceOf(NatsException.class);
    }
}
