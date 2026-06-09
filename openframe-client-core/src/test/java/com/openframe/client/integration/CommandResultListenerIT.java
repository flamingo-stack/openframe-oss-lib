package com.openframe.client.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.integration.support.CommandResultIntegrationTestApplication;
import com.openframe.client.publisher.CommandResultPublisher;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
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

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * End-to-end (NATS) integration test for the command-result path: a message
 * published by the agent over core NATS on {@code machine.<id>.command-execution.result}
 * must be consumed by {@link com.openframe.client.listener.CommandResultListener},
 * transformed into a {@link CommonDebeziumMessage} and forwarded to the
 * {@link CommandResultPublisher} boundary with the {@code message-type} header.
 *
 * <p>Uses a real NATS broker (Testcontainers); the publisher is mocked so the
 * assertion is on the transformed envelope (payload.after + headers) reaching the
 * publish boundary — the Kafka cluster / topic choice itself is out of scope here.
 */
@SpringBootTest(
        classes = CommandResultIntegrationTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE
)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CommandResultListenerIT {

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
    }

    @Autowired
    private Connection natsConnection;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CommandResultPublisher commandResultPublisher;

    @BeforeEach
    void resetPublisher() {
        // Context (and its mock publisher bean) is reused across test methods.
        org.mockito.Mockito.reset(commandResultPublisher);
    }

    @Test
    @DisplayName("A command-result published over core NATS is consumed, transformed into a CommonDebeziumMessage, and forwarded to the publisher keyed by machineId with the message-type header")
    void commandResult_consumedTransformedAndForwarded() throws Exception {
        CommandResultMessage payload = CommandResultMessage.builder()
                .executionId("exec-1")
                .machineId("machine-42")
                .stdout("hey\n")
                .stderr("")
                .exitCode(0)
                .executionTimeMs(12L)
                .timedOut(false)
                .build();

        natsConnection.publish("machine.machine-42.command-execution.result",
                objectMapper.writeValueAsBytes(payload));
        natsConnection.flush(Duration.ofSeconds(2));

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(commandResultPublisher).publish(eq("machine-42"),
                        any(CommonDebeziumMessage.class), anyMap()));

        org.mockito.ArgumentCaptor<CommonDebeziumMessage> envelope =
                org.mockito.ArgumentCaptor.forClass(CommonDebeziumMessage.class);
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<Map<String, Object>> headers =
                org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(commandResultPublisher).publish(eq("machine-42"), envelope.capture(), headers.capture());

        assertThat(headers.getValue()).containsEntry(KafkaHeader.MESSAGE_TYPE_HEADER, "RMM");
        assertThat(envelope.getValue().getPayload().getOperation()).isEqualTo("c");

        JsonNode after = envelope.getValue().getPayload().getAfter();
        assertThat(after.get("tenantId").asText()).isEqualTo("tenant-it");
        assertThat(after.get("machineId").asText()).isEqualTo("machine-42");
        assertThat(after.get("executionId").asText()).isEqualTo("exec-1");
        assertThat(after.get("stdout").asText()).isEqualTo("hey\n");
        assertThat(after.get("exitCode").asInt()).isZero();
        assertThat(after.get("executionTimeMs").asLong()).isEqualTo(12L);
        assertThat(after.get("timedOut").asBoolean()).isFalse();
        assertThat(after.get("eventTimestamp").asLong()).isPositive();
    }

    @Test
    @DisplayName("A command-result on a different machine subject is keyed by that machineId — per-machine routing is preserved")
    void commandResult_perMachineKey() throws Exception {
        CommandResultMessage payload = CommandResultMessage.builder()
                .executionId("exec-2")
                .exitCode(1)
                .stderr("boom")
                .timedOut(false)
                .build();

        natsConnection.publish("machine.node-7.command-execution.result",
                objectMapper.writeValueAsBytes(payload));
        natsConnection.flush(Duration.ofSeconds(2));

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(commandResultPublisher).publish(eq("node-7"),
                        any(CommonDebeziumMessage.class), anyMap()));
    }

    @Test
    @DisplayName("A message on a non-command-result subject (machine.<id>.heartbeat) is filtered out by the subscription and never produces an event")
    void nonCommandResultSubject_isIgnored() throws Exception {
        CommandResultMessage payload = CommandResultMessage.builder()
                .executionId("exec-ghost")
                .exitCode(0)
                .stdout("should-not-be-forwarded")
                .build();
        byte[] body = objectMapper.writeValueAsBytes(payload);

        // Wrong subject — must NOT match the listener's "machine.*.command-execution.result" filter.
        natsConnection.publish("machine.ghost.heartbeat", body);
        // Sentinel on the correct subject, published right after on the same connection (FIFO):
        // once the sentinel is processed, the earlier message has already been routed (or filtered).
        natsConnection.publish("machine.sentinel.command-execution.result", body);
        natsConnection.flush(Duration.ofSeconds(2));

        // Wait until the sentinel has flowed through the whole pipeline.
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(commandResultPublisher).publish(eq("sentinel"), any(CommonDebeziumMessage.class), anyMap()));

        // Exactly one publish total — only the sentinel — proving the heartbeat was filtered out.
        verify(commandResultPublisher, times(1)).publish(anyString(), any(CommonDebeziumMessage.class), anyMap());
        verify(commandResultPublisher, never()).publish(eq("ghost"), any(CommonDebeziumMessage.class), anyMap());
    }
}
