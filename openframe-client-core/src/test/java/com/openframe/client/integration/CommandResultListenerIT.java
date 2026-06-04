package com.openframe.client.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.integration.support.CommandResultIntegrationTestApplication;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.kafka.model.CommandResultEvent;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import io.nats.client.Connection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * End-to-end (NATS) integration test for the command-result path: a message
 * published by the agent over core NATS on {@code machine.<id>.command-result}
 * must be consumed by {@link com.openframe.client.listener.CommandResultListener},
 * transformed, and forwarded to Kafka via {@link OssTenantRetryingKafkaProducer}.
 *
 * <p>Uses a real NATS broker (Testcontainers); the Kafka producer is mocked so
 * the assertion is on the transformed {@link CommandResultEvent} reaching the
 * producer boundary — Kafka brokering itself is out of scope here.
 */
@SpringBootTest(
        classes = CommandResultIntegrationTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE
)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CommandResultListenerIT {

    private static final String TOPIC = "command-results";

    static final GenericContainer<?> NATS =
            new GenericContainer<>(DockerImageName.parse("nats:2.10-alpine"))
                    .withExposedPorts(4222)
                    .withCommand("-js")
                    .waitingFor(Wait.forLogMessage(".*Server is ready.*", 1));

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        if (!NATS.isRunning()) {
            NATS.start();
        }
        registry.add("nats.spring.server",
                () -> "nats://" + NATS.getHost() + ":" + NATS.getMappedPort(4222));
        registry.add("openframe.oss-tenant.kafka.topics.outbound.command-results-topic", () -> TOPIC);
    }

    @Autowired
    private Connection natsConnection;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private OssTenantRetryingKafkaProducer kafkaProducer;

    @BeforeEach
    void resetProducer() {
        // Context (and its mock producer bean) is reused across test methods.
        org.mockito.Mockito.reset(kafkaProducer);
    }

    @Test
    @DisplayName("A command-result published over core NATS is consumed, transformed, and forwarded to Kafka keyed by machineId")
    void commandResult_consumedTransformedAndForwardedToKafka() throws Exception {
        CommandResultMessage payload = CommandResultMessage.builder()
                .executionId("exec-1")
                .status("COMPLETED")
                .result("hey\n")
                .build();

        natsConnection.publish("machine.machine-42.command-result",
                objectMapper.writeValueAsBytes(payload));
        natsConnection.flush(Duration.ofSeconds(2));

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(kafkaProducer).publish(eq(TOPIC), eq("machine-42"),
                        org.mockito.ArgumentMatchers.any(CommandResultEvent.class)));

        org.mockito.ArgumentCaptor<CommandResultEvent> captor =
                org.mockito.ArgumentCaptor.forClass(CommandResultEvent.class);
        verify(kafkaProducer).publish(eq(TOPIC), eq("machine-42"), captor.capture());

        CommandResultEvent envelope = captor.getValue();
        assertThat(envelope.getPayload()).isNotNull();
        assertThat(envelope.getPayload().getOperation()).isEqualTo("c");

        CommandResultEvent data = envelope.getPayload().getAfter();
        assertThat(data.getMachineId()).isEqualTo("machine-42");
        assertThat(data.getExecutionId()).isEqualTo("exec-1");
        assertThat(data.getStatus()).isEqualTo("COMPLETED");
        assertThat(data.getResult()).isEqualTo("hey\n");
        assertThat(data.getEventTimestamp()).isNotNull();
    }

    @Test
    @DisplayName("A command-result on a different machine subject is keyed by that machineId — per-machine routing is preserved")
    void commandResult_perMachineKey() throws Exception {
        CommandResultMessage payload = CommandResultMessage.builder()
                .executionId("exec-2")
                .status("FAILED")
                .result("boom")
                .build();

        natsConnection.publish("machine.node-7.command-result",
                objectMapper.writeValueAsBytes(payload));
        natsConnection.flush(Duration.ofSeconds(2));

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(kafkaProducer).publish(eq(TOPIC), eq("node-7"),
                        any(CommandResultEvent.class)));
    }

    @Test
    @DisplayName("A message on a non-command-result subject (machine.<id>.heartbeat) is filtered out by the subscription and never produces a Kafka event")
    void nonCommandResultSubject_isIgnored() throws Exception {
        CommandResultMessage payload = CommandResultMessage.builder()
                .executionId("exec-ghost")
                .status("COMPLETED")
                .result("should-not-be-forwarded")
                .build();
        byte[] body = objectMapper.writeValueAsBytes(payload);

        // Wrong subject — must NOT match the listener's "machine.*.command-result" filter.
        natsConnection.publish("machine.ghost.heartbeat", body);
        // Sentinel on the correct subject, published right after on the same connection (FIFO):
        // once the sentinel is processed, the earlier message has already been routed (or filtered).
        natsConnection.publish("machine.sentinel.command-result", body);
        natsConnection.flush(Duration.ofSeconds(2));

        // Wait until the sentinel has flowed through the whole pipeline.
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(kafkaProducer).publish(eq(TOPIC), eq("sentinel"), any(CommandResultEvent.class)));

        // Exactly one publish total — only the sentinel — proving the heartbeat was filtered out.
        verify(kafkaProducer, times(1)).publish(any(), any(), any(CommandResultEvent.class));
        verify(kafkaProducer, never()).publish(eq(TOPIC), eq("ghost"), any(CommandResultEvent.class));
    }
}
