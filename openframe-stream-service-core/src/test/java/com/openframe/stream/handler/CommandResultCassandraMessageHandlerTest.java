package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.cassandra.model.CommandResult;
import com.openframe.data.cassandra.repository.CommandResultRepository;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class CommandResultCassandraMessageHandlerTest {

    private static final String EXECUTION_ID = "exec-1";
    private static final String MACHINE_ID = "machine-1";

    @Mock
    private CommandResultRepository commandResultRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private CommandResultCassandraMessageHandler handler;

    @BeforeEach
    void setUp() {
        handler = new CommandResultCassandraMessageHandler(commandResultRepository, mapper);
    }

    @Test
    @DisplayName("Routed result (already known PENDING) → saves a command_results row keyed by (executionId, machineId) with the 8 agent fields packed into one typed JSON")
    void savesPackedResult() {
        handler.handle(message(fullAfter()), null);

        ArgumentCaptor<CommandResult> captor = ArgumentCaptor.forClass(CommandResult.class);
        verify(commandResultRepository).save(captor.capture());
        CommandResult saved = captor.getValue();
        assertThat(saved.getKey().getExecutionId()).isEqualTo(EXECUTION_ID);
        assertThat(saved.getKey().getMachineId()).isEqualTo(MACHINE_ID);

        JsonNode result = readResult(saved.getResult());
        assertThat(result.get("executionId").asText()).isEqualTo(EXECUTION_ID);
        assertThat(result.get("machineId").asText()).isEqualTo(MACHINE_ID);
        assertThat(result.get("stdout").asText()).isEqualTo("hello");
        assertThat(result.get("stderr").asText()).isEqualTo("oops");
        assertThat(result.get("exitCode").isInt()).isTrue();
        assertThat(result.get("exitCode").asInt()).isEqualTo(0);
        assertThat(result.get("executionTimeMs").asLong()).isEqualTo(1234L);
        assertThat(result.get("timedOut").isBoolean()).isTrue();
        assertThat(result.get("timedOut").asBoolean()).isFalse();
        assertThat(result.get("error").asText()).isEqualTo("none");
    }

    @Test
    @DisplayName("Payload missing executionId → defensive short-circuit, nothing written")
    void missingExecutionId_shortCircuits() {
        ObjectNode after = mapper.createObjectNode();
        after.put("machineId", MACHINE_ID);

        handler.handle(message(after), null);

        verifyNoInteractions(commandResultRepository);
    }

    private ObjectNode fullAfter() {
        ObjectNode after = mapper.createObjectNode();
        after.put("executionId", EXECUTION_ID);
        after.put("machineId", MACHINE_ID);
        after.put("stdout", "hello");
        after.put("stderr", "oops");
        after.put("exitCode", "0");            // arrives as string → handler types it
        after.put("executionTimeMs", "1234");  // arrives as string → handler types it
        after.put("timedOut", "false");        // arrives as string → handler types it
        after.put("error", "none");
        return after;
    }

    private DeserializedDebeziumMessage message(ObjectNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        return DeserializedDebeziumMessage.builder().payload(payload).build();
    }

    private JsonNode readResult(String json) {
        try {
            return mapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
