package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.CommandExecutionRequest;
import com.openframe.data.document.rmm.CommandExecutionStatus;
import com.openframe.data.model.enums.Destination;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.CommandExecutionRequestRepository;
import com.openframe.stream.mapping.SourceEventTypes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Unit test for the RMM command-result type processing — the branching that maps
 * the agent's {@code CommandExecutionResult} (camelCase {@code after}) into the
 * unified result/error/details JSON, plus the exclusive routing decision. Lives
 * in the same package to exercise the protected/package-private hooks directly.
 */
@ExtendWith(MockitoExtension.class)
class CommandResultDeserializerTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Mock
    private CommandExecutionRequestRepository commandExecutionRequestRepository;

    private CommandResultDeserializer deserializer;

    @BeforeEach
    void setUp() {
        deserializer = new CommandResultDeserializer(mapper, commandExecutionRequestRepository);
    }

    private ObjectNode after() {
        return mapper.createObjectNode();
    }

    private JsonNode parse(String json) throws Exception {
        return mapper.readTree(json);
    }

    @Test
    @DisplayName("getType is RMM and sourceEventType is always the terminal cmd_run.finished")
    void typeAndSourceEventType() {
        assertThat(deserializer.getType()).isEqualTo(MessageType.COMMAND_EXECUTED);
        assertThat(deserializer.getSourceEventType(after())).contains(SourceEventTypes.Rmm.CMD_RUN_FINISHED);
    }

    @Test
    @DisplayName("agentId=machineId, eventToolId=executionId; absent fields → empty")
    void idsExtraction() {
        ObjectNode after = after().put("machineId", "machine-42").put("executionId", "exec-1");
        assertThat(deserializer.getAgentId(after)).contains("machine-42");
        assertThat(deserializer.getEventToolId(after)).contains("exec-1");

        assertThat(deserializer.getAgentId(after())).isEmpty();
        assertThat(deserializer.getEventToolId(after())).isEmpty();
    }

    @Test
    @DisplayName("tenantId is read from the payload (shared Kafka scope); absent → empty")
    void tenantIdExtraction() {
        assertThat(deserializer.getTenantId(after().put("tenantId", "tenant-1"))).contains("tenant-1");
        assertThat(deserializer.getTenantId(after())).isEmpty();
    }

    @Test
    @DisplayName("sourceEventTimestamp parses eventTimestamp as long; absent → empty")
    void timestampExtraction() {
        assertThat(deserializer.getSourceEventTimestamp(after().put("eventTimestamp", 1700000000000L)))
                .contains(1700000000000L);
        assertThat(deserializer.getSourceEventTimestamp(after())).isEmpty();
    }

    @Test
    @DisplayName("getMessage: timed out > exit code > generic")
    void message() {
        assertThat(deserializer.getMessage(after().put("timedOut", true))).contains("Command timed out");
        // timedOut wins even when an exit code is present
        assertThat(deserializer.getMessage(after().put("timedOut", true).put("exitCode", 0)))
                .contains("Command timed out");
        assertThat(deserializer.getMessage(after().put("exitCode", 0))).contains("Command finished (exit code 0)");
        assertThat(deserializer.getMessage(after().put("exitCode", 137))).contains("Command finished (exit code 137)");
        assertThat(deserializer.getMessage(after())).contains("Command finished");
    }

    @Test
    @DisplayName("getResult: stdout + numeric exit_code/execution_time_ms; empty input → null")
    void result() throws Exception {
        ObjectNode after = after().put("stdout", "hey\n").put("exitCode", 0).put("executionTimeMs", 12L);
        JsonNode result = parse(deserializer.getResult(after));
        assertThat(result.get("output").asText()).isEqualTo("hey\n");
        assertThat(result.get("exit_code").isInt()).isTrue();
        assertThat(result.get("exit_code").asInt()).isZero();
        assertThat(result.get("execution_time_ms").isNumber()).isTrue();
        assertThat(result.get("execution_time_ms").asLong()).isEqualTo(12L);

        // No stdout / exit code / duration → nothing to report
        assertThat(deserializer.getResult(after().put("machineId", "m"))).isNull();
    }

    @Test
    @DisplayName("getError: null on clean success; populated on failure / stderr / timeout")
    void error() throws Exception {
        // exit 0, no stderr/error, not timed out → no error block
        assertThat(deserializer.getError(after().put("exitCode", 0))).isNull();

        // non-zero exit code → failure
        JsonNode failed = parse(deserializer.getError(after().put("exitCode", 1)));
        assertThat(failed.get("exit_code").asInt()).isEqualTo(1);

        // stderr present even with exit 0 → reported as output
        JsonNode stderr = parse(deserializer.getError(after().put("exitCode", 0).put("stderr", "boom")));
        assertThat(stderr.get("output").asText()).isEqualTo("boom");

        // explicit error string
        JsonNode err = parse(deserializer.getError(after().put("error", "connection refused")));
        assertThat(err.get("error").asText()).isEqualTo("connection refused");

        // timed out → timed_out flag
        JsonNode timed = parse(deserializer.getError(after().put("timedOut", true)));
        assertThat(timed.get("timed_out").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("getDetails: exit_code/execution_time_ms/timed_out; empty input → null")
    void details() throws Exception {
        JsonNode details = parse(deserializer.getDetails(
                after().put("exitCode", 0).put("executionTimeMs", 12L).put("timedOut", false)));
        assertThat(details.get("exit_code").asInt()).isZero();
        assertThat(details.get("execution_time_ms").asLong()).isEqualTo(12L);
        assertThat(details.get("timed_out").asBoolean()).isFalse();

        assertThat(deserializer.getDetails(after().put("stdout", "x"))).isNull();
    }

    @Test
    @DisplayName("non-numeric exit_code falls back to a string value (putIntOrString)")
    void nonNumericExitCodeFallsBackToString() throws Exception {
        JsonNode result = parse(deserializer.getResult(after().put("exitCode", "n/a")));
        assertThat(result.get("exit_code").isTextual()).isTrue();
        assertThat(result.get("exit_code").asText()).isEqualTo("n/a");
    }

    @Test
    @DisplayName("PENDING batch result → excludes the default log destinations (goes ONLY to command_results)")
    void routing_pending_excludesDefaultFlow() {
        when(commandExecutionRequestRepository.findByMachineIdAndExecutionId("machine-1", "exec-1"))
                .thenReturn(Optional.of(CommandExecutionRequest.builder()
                        .machineId("machine-1").executionId("exec-1")
                        .status(CommandExecutionStatus.PENDING).build()));

        ObjectNode after = after().put("machineId", "machine-1").put("executionId", "exec-1");

        assertThat(deserializer.excludedDestinationsFor(after))
                .containsExactlyInAnyOrder(Destination.CASSANDRA, Destination.KAFKA);
    }

    @Test
    @DisplayName("Request present but already EXECUTED → excludes command_results (follows the default flow)")
    void routing_nonPending_excludesCommandResults() {
        when(commandExecutionRequestRepository.findByMachineIdAndExecutionId("machine-1", "exec-1"))
                .thenReturn(Optional.of(CommandExecutionRequest.builder()
                        .machineId("machine-1").executionId("exec-1")
                        .status(CommandExecutionStatus.EXECUTED).build()));

        ObjectNode after = after().put("machineId", "machine-1").put("executionId", "exec-1");

        assertThat(deserializer.excludedDestinationsFor(after))
                .containsExactly(Destination.CASSANDRA_COMMAND_RESULT);
    }

    @Test
    @DisplayName("No matching request in Mongo → excludes command_results (default flow)")
    void routing_noRequest_excludesCommandResults() {
        when(commandExecutionRequestRepository.findByMachineIdAndExecutionId("machine-1", "exec-1"))
                .thenReturn(Optional.empty());

        ObjectNode after = after().put("machineId", "machine-1").put("executionId", "exec-1");

        assertThat(deserializer.excludedDestinationsFor(after))
                .containsExactly(Destination.CASSANDRA_COMMAND_RESULT);
    }

    @Test
    @DisplayName("Missing executionId/machineId → no Mongo lookup, defaults to the normal flow")
    void routing_missingIds_skipsLookupAndDefaults() {
        assertThat(deserializer.excludedDestinationsFor(after().put("machineId", "machine-1")))
                .containsExactly(Destination.CASSANDRA_COMMAND_RESULT);
        verifyNoInteractions(commandExecutionRequestRepository);
    }
}
