package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.model.enums.MessageType;
import com.openframe.stream.mapping.SourceEventTypes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link ScriptResultDeserializer} is the saved-script binding of the shared
 * {@link RmmResultDeserializer}: it differs from {@link CommandResultDeserializer}
 * ONLY in the bound {@link MessageType} ({@code SCRIPT_EXECUTED}); all extraction
 * logic is inherited. These tests lock the binding and confirm the inherited
 * behaviour is wired through.
 */
class ScriptResultDeserializerTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private ScriptResultDeserializer deserializer;

    @BeforeEach
    void setUp() {
        deserializer = new ScriptResultDeserializer(mapper);
    }

    @Test
    @DisplayName("getType is SCRIPT_EXECUTED — the only difference from the command binding")
    void getTypeIsScriptExecuted() {
        assertThat(deserializer.getType()).isEqualTo(MessageType.SCRIPT_EXECUTED);
    }

    @Test
    @DisplayName("sourceEventType is the shared terminal cmd_run.finished — command and script are distinguished by MessageType, not source-event-type")
    void sourceEventTypeIsShared() {
        assertThat(deserializer.getSourceEventType(mapper.createObjectNode()))
                .contains(SourceEventTypes.Rmm.CMD_RUN_FINISHED);
    }

    @Test
    @DisplayName("inherited extraction works — getResult builds stdout/exit_code/execution_time_ms exactly like the command deserializer")
    void inheritsResultExtraction() throws Exception {
        ObjectNode after = mapper.createObjectNode()
                .put("stdout", "ok\n").put("exitCode", 0).put("executionTimeMs", 7L);

        JsonNode result = mapper.readTree(deserializer.getResult(after));

        assertThat(result.get("output").asText()).isEqualTo("ok\n");
        assertThat(result.get("exit_code").asInt()).isZero();
        assertThat(result.get("execution_time_ms").asLong()).isEqualTo(7L);
    }
}
