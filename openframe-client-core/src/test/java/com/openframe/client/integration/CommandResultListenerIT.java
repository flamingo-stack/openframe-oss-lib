package com.openframe.client.integration;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.openframe.client.integration.support.CommandResultIntegrationTestApplication;
import com.openframe.client.listener.rmm.AbstractRmmResultListener;
import com.openframe.client.listener.rmm.CommandResultListener;
import com.openframe.client.publisher.EventLogsPublisher;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.nats.rmm.model.CommandResultMessage;
import com.openframe.kafka.enumeration.KafkaHeader;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import io.nats.client.Connection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.util.Map;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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
 * must be consumed by {@link CommandResultListener},
 * transformed into a {@link CommonDebeziumMessage} and forwarded to the
 * {@link EventLogsPublisher} boundary with the {@code message-type} header.
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
    private EventLogsPublisher eventLogsPublisher;

    @BeforeEach
    void resetPublisher() {
        // Context (and its mock publisher bean) is reused across test methods.
        org.mockito.Mockito.reset(eventLogsPublisher);
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
                verify(eventLogsPublisher).publish(eq("machine-42"),
                        any(CommonDebeziumMessage.class), anyMap()));

        org.mockito.ArgumentCaptor<CommonDebeziumMessage> envelope =
                org.mockito.ArgumentCaptor.forClass(CommonDebeziumMessage.class);
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<Map<String, Object>> headers =
                org.mockito.ArgumentCaptor.forClass(Map.class);
        verify(eventLogsPublisher).publish(eq("machine-42"), envelope.capture(), headers.capture());

        assertThat(headers.getValue())
                .containsEntry(KafkaHeader.MESSAGE_TYPE_HEADER, MessageType.COMMAND_EXECUTED.name());
        assertThat(envelope.getValue().getPayload().getOperation()).isEqualTo("c");

        JsonNode after = envelope.getValue().getPayload().getAfter();
        assertThat(after.get("tenantId").asString()).isEqualTo("tenant-it");
        assertThat(after.get("machineId").asString()).isEqualTo("machine-42");
        assertThat(after.get("executionId").asString()).isEqualTo("exec-1");
        assertThat(after.get("stdout").asString()).isEqualTo("hey\n");
        assertThat(after.get("exitCode").asInt()).isZero();
        assertThat(after.get("executionTimeMs").asLong()).isEqualTo(12L);
        assertThat(after.get("timedOut").asBoolean()).isFalse();
        assertThat(after.get("eventTimestamp").asLong()).isPositive();
    }

    @Test
    @DisplayName("Command diagnostics mask the launch credential before forwarding the result")
    void commandResult_masksLaunchCredentialBeforePublishing() {
        // setup
        CommandResultMessage payload = CommandResultMessage.builder()
                .executionId("exec-redaction")
                .stdout("""
                        State     : Running
                        StartMode : Auto
                        PathName  : "C:\\Program Files\\Example Agent\\agent.exe" --openframe-mode --openframe-secret "fixture-a181 stdout" --service
                        Details   : --openframe-secret=fixture-a181-repeat --openframe-secret-file sample.txt
                        Name      : FirstWrappedAgent
                        PathName  : "C:\\First Agent\\agent.exe" --openframe-secret\s
                                    "fixture-a181-next-line" --service
                        State     : Paused
                        StartMode : Disabled
                        Name      : SecondWrappedAgent
                        PathName  : "C:\\Second Agent\\agent.exe" --openframe-secret "fixture-a181-wrap-
                                    second-line-of-credential" --service
                        State     : Stopped
                        StartMode : Manual
                        Previous  : --OpenFrame-Secret "fixture-a181-escape\\"escaped-tail" --previous
                        """)
                .stderr("Probe failed for --openframe-secret='fixture-a181-stderr' at step 2")
                .error("Could not start --openframe-secret fixture-a181-error --retry\n"
                        + "Earlier invocation: --openframe-secret \"fixture-a181-truncated")
                .failureReason("BLOCKED --openframe-secret=\"fixture-a181-reason\"")
                .exitCode(1)
                .executionTimeMs(28L)
                .timedOut(false)
                .build();
        org.mockito.ArgumentCaptor<CommonDebeziumMessage> envelope =
                org.mockito.ArgumentCaptor.forClass(CommonDebeziumMessage.class);

        // execution
        natsConnection.publish("machine.redaction-device.command-execution.result",
                objectMapper.writeValueAsBytes(payload));
        assertDoesNotThrow(() -> natsConnection.flush(Duration.ofSeconds(2)));

        // verifications
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(eventLogsPublisher).publish(eq("redaction-device"), envelope.capture(),
                        eq(Map.of(KafkaHeader.MESSAGE_TYPE_HEADER, MessageType.COMMAND_EXECUTED.name()))));

        JsonNode after = envelope.getValue().getPayload().getAfter();
        assertThat(after.get("stdout").asString()).isEqualTo("""
                State     : Running
                StartMode : Auto
                PathName  : "C:\\Program Files\\Example Agent\\agent.exe" --openframe-mode --openframe-secret "[REDACTED]" --service
                Details   : --openframe-secret=[REDACTED] --openframe-secret-file sample.txt
                Name      : FirstWrappedAgent
                PathName  : "C:\\First Agent\\agent.exe" --openframe-secret\s
                            "[REDACTED]" --service
                State     : Paused
                StartMode : Disabled
                Name      : SecondWrappedAgent
                PathName  : "C:\\Second Agent\\agent.exe" --openframe-secret "[REDACTED]" --service
                State     : Stopped
                StartMode : Manual
                Previous  : --OpenFrame-Secret "[REDACTED]" --previous
                """);
        assertThat(after.get("stderr").asString()).isEqualTo("Probe failed for --openframe-secret='[REDACTED]' at step 2");
        assertThat(after.get("error").asString()).isEqualTo("Could not start --openframe-secret [REDACTED] --retry\n"
                + "Earlier invocation: --openframe-secret \"[REDACTED]");
        assertThat(after.get("failureReason").asString()).isEqualTo("BLOCKED --openframe-secret=\"[REDACTED]\"");
        assertThat(after.get("exitCode").asInt()).isEqualTo(1);
        assertThat(after.get("executionTimeMs").asLong()).isEqualTo(28L);
        assertThat(after.get("timedOut").asBoolean()).isFalse();
    }

    @Test
    @DisplayName("Malformed command results retain routing context in logs without exposing the rejected value")
    void malformedCommandResult_logsRoutingWithoutRejectedValue() {
        // setup
        String subject = "machine.malformed-result.command-execution.result";
        String rejectedValue = "fixture-a181-malformed";
        byte[] invalid = objectMapper.writeValueAsBytes(Map.of(
                "execution_id", "exec-malformed",
                "exit_code", "--openframe-secret " + rejectedValue));
        byte[] valid = objectMapper.writeValueAsBytes(CommandResultMessage.builder()
                .executionId("exec-next")
                .exitCode(0)
                .build());
        Queue<ILoggingEvent> loggedResults = new ConcurrentLinkedQueue<>();
        AppenderBase<ILoggingEvent> appender = new AppenderBase<>() {
            @Override
            protected void append(ILoggingEvent event) {
                if (event.getFormattedMessage().contains(subject)) {
                    loggedResults.add(event);
                }
            }
        };
        Logger listenerLogger = (Logger) LoggerFactory.getLogger(AbstractRmmResultListener.class);
        appender.start();
        listenerLogger.addAppender(appender);

        try {
            publishMalformedAndSentinel(subject, invalid, valid);
            assertRejectedResultLoggedSafely(loggedResults, subject, invalid.length, rejectedValue);
        } finally {
            listenerLogger.detachAppender(appender);
            appender.stop();
        }
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
                verify(eventLogsPublisher).publish(eq("node-7"),
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
                verify(eventLogsPublisher).publish(eq("sentinel"), any(CommonDebeziumMessage.class), anyMap()));

        // Exactly one publish total — only the sentinel — proving the heartbeat was filtered out.
        verify(eventLogsPublisher, times(1)).publish(anyString(), any(CommonDebeziumMessage.class), anyMap());
        verify(eventLogsPublisher, never()).publish(eq("ghost"), any(CommonDebeziumMessage.class), anyMap());
    }

    private void publishMalformedAndSentinel(String subject, byte[] invalid, byte[] valid) {
        natsConnection.publish(subject, invalid);
        natsConnection.publish("machine.after-malformed.command-execution.result", valid);
        assertDoesNotThrow(() -> natsConnection.flush(Duration.ofSeconds(2)));
    }

    private void assertRejectedResultLoggedSafely(Queue<ILoggingEvent> loggedResults, String subject, int payloadSize,
                                                String rejectedValue) {
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() ->
                verify(eventLogsPublisher).publish(eq("after-malformed"),
                        any(CommonDebeziumMessage.class), anyMap()));
        verify(eventLogsPublisher, never()).publish(eq("malformed-result"),
                any(CommonDebeziumMessage.class), anyMap());
        assertThat(loggedResults).hasSize(1);
        ILoggingEvent event = loggedResults.element();
        assertThat(event.getArgumentArray()).containsExactly("command", subject, payloadSize, "InvalidFormatException");
        assertThat(event.getFormattedMessage()).doesNotContain(rejectedValue);
        assertThat(event.getThrowableProxy()).isNull();
    }
}
