package com.openframe.client.service;

import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.kafka.model.CommandResultEvent;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CommandResultServiceTest {

    private static final String TOPIC = "command-results";
    private static final String MACHINE_ID = "machine-42";

    @Mock
    private OssTenantRetryingKafkaProducer kafkaProducer;

    @InjectMocks
    private CommandResultService commandResultService;

    @BeforeEach
    void setUp() {
        // @Value field is not injected by Mockito — set it explicitly.
        ReflectionTestUtils.setField(commandResultService, "commandResultsTopic", TOPIC);
    }

    @Test
    @DisplayName("processCommandResult: maps the agent message into a CommandResultEvent and publishes to the configured topic, keyed by machineId")
    void processCommandResult_mapsAndPublishes() {
        CommandResultMessage message = CommandResultMessage.builder()
                .executionId("exec-1")
                .machineId(MACHINE_ID)
                .stdout("hey\n")
                .stderr("")
                .exitCode(0)
                .executionTimeMs(12L)
                .timedOut(false)
                .build();

        commandResultService.processCommandResult(MACHINE_ID, message);

        ArgumentCaptor<CommandResultEvent> captor = ArgumentCaptor.forClass(CommandResultEvent.class);
        verify(kafkaProducer).publish(eq(TOPIC), eq(MACHINE_ID), captor.capture());

        CommandResultEvent envelope = captor.getValue();
        assertThat(envelope.getPayload()).isNotNull();
        assertThat(envelope.getPayload().getOperation()).isEqualTo("c");
        assertThat(envelope.getPayload().getTimestamp()).isNotNull().isPositive();

        CommandResultEvent data = envelope.getPayload().getAfter();
        assertThat(data).isNotNull();
        assertThat(data.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(data.getExecutionId()).isEqualTo("exec-1");
        assertThat(data.getStdout()).isEqualTo("hey\n");
        assertThat(data.getStderr()).isEmpty();
        assertThat(data.getExitCode()).isZero();
        assertThat(data.getExecutionTimeMs()).isEqualTo(12L);
        assertThat(data.getTimedOut()).isFalse();
        // Timestamp is stamped server-side, not taken from the agent payload.
        assertThat(data.getEventTimestamp()).isNotNull().isPositive();
    }

    @Test
    @DisplayName("processCommandResult: still stamps a server-side eventTimestamp when the agent payload carries only an executionId")
    void processCommandResult_stampsTimestampForSparsePayload() {
        CommandResultMessage message = CommandResultMessage.builder()
                .executionId("exec-2")
                .build();

        commandResultService.processCommandResult(MACHINE_ID, message);

        ArgumentCaptor<CommandResultEvent> captor = ArgumentCaptor.forClass(CommandResultEvent.class);
        verify(kafkaProducer).publish(eq(TOPIC), eq(MACHINE_ID), captor.capture());

        CommandResultEvent data = captor.getValue().getPayload().getAfter();
        assertThat(data.getExecutionId()).isEqualTo("exec-2");
        assertThat(data.getStdout()).isNull();
        assertThat(data.getExitCode()).isNull();
        assertThat(data.getTimedOut()).isNull();
        assertThat(data.getEventTimestamp()).isNotNull();
    }
}
