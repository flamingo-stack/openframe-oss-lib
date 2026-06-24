package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.Execution;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.ExecutionRepository;
import com.openframe.stream.mapping.SourceEventTypes;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * {@link ScriptResultDeserializer} is the saved-script binding of the shared
 * {@link RmmResultDeserializer}: it differs from {@link CommandResultDeserializer}
 * in the bound {@link MessageType} AND in {@code getMessage}, which produces a
 * human-readable {@code "Script <name> executed."} summary instead of the base
 * "Command finished/timed out" template.
 */
@ExtendWith(MockitoExtension.class)
class ScriptResultDeserializerTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-1";

    @Mock
    private ExecutionRepository executionRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private ScriptResultDeserializer deserializer;

    @BeforeEach
    void setUp() {
        deserializer = new ScriptResultDeserializer(mapper, executionRepository);
    }

    @Test
    @DisplayName("getType is SCRIPT_EXECUTED — the only difference at the routing layer from the command binding")
    void getTypeIsScriptExecuted() {
        assertThat(deserializer.getType()).isEqualTo(MessageType.SCRIPT_EXECUTED);
    }

    @Test
    @DisplayName("sourceEventType is script_run.finished — distinct from the command's cmd_run.finished so EventTypeMapper maps it to the user-facing SCRIPT_EXECUTED")
    void sourceEventTypeIsScriptRunFinished() {
        assertThat(deserializer.getSourceEventType(mapper.createObjectNode()))
                .contains(SourceEventTypes.Rmm.SCRIPT_RUN_FINISHED);
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

    @Test
    @DisplayName("getMessage: an Execution row with a scriptName snapshot produces \"Script <name> executed.\" — the format the History UI surfaces in the LogEvent summary")
    void getMessage_withScriptName_returnsFormattedSummary() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 0);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptName("disk usage")));

        assertThat(deserializer.getMessage(after)).contains("Script disk usage executed.");
    }

    @Test
    @DisplayName("getMessage: succeeds even when the script run FAILED (exitCode != 0) — message is about \"a script ran\", status lives elsewhere")
    void getMessage_alsoForFailedRuns() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 1);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptName("disk usage")));

        // Format is invariant of outcome — the user-visible status badge is rendered separately.
        assertThat(deserializer.getMessage(after)).contains("Script disk usage executed.");
    }

    @Test
    @DisplayName("getMessage: no Execution row found → falls back to \"Script executed\" so the message is never null even on race / missing row")
    void getMessage_rowMissing_fallsBackToGeneric() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.empty());

        assertThat(deserializer.getMessage(after)).contains("Script executed");
    }

    @Test
    @DisplayName("getMessage: missing tenantId / executionId on the payload → fallback (no Mongo lookup attempted)")
    void getMessage_missingIdentifiers_fallsBackWithoutMongoCall() {
        ObjectNode after = mapper.createObjectNode().put("exitCode", 0);

        assertThat(deserializer.getMessage(after)).contains("Script executed");
        org.mockito.Mockito.verifyNoInteractions(executionRepository);
    }

    @Test
    @DisplayName("getMessage: Mongo throws → caught silently, fallback returned — deserialize must NOT break the Kafka consumer thread")
    void getMessage_mongoFailure_fallsBackQuietly() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenThrow(new RuntimeException("Mongo down"));

        assertThat(deserializer.getMessage(after)).contains("Script executed");
    }

    @Test
    @DisplayName("getMessage: a blank/null scriptName on the row (defensive) → fallback")
    void getMessage_blankScriptName_fallsBackToGeneric() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(executionRepository.findByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptName("")));

        assertThat(deserializer.getMessage(after)).contains("Script executed");
    }

    private static Execution executionWithScriptName(String name) {
        return Execution.builder().scriptName(name).build();
    }
}
