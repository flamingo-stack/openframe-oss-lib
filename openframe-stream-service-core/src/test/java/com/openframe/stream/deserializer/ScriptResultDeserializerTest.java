package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
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
 * {@link ScriptResultDeserializer} is the saved-script binding of the shared
 * {@link RmmResultDeserializer}: it differs from {@link CommandResultDeserializer}
 * in the bound {@link MessageType} AND in {@code getMessage}, which produces a
 * human-readable {@code "Script <name> executed."} summary instead of the base
 * "Command finished/timed out" template.
 *
 * <p>The script name is NOT snapshotted on the Execution row — it is resolved at
 * read time: the result's {@code (tenantId, executionId)} → the Execution row's
 * {@code scriptId} → the {@link Script} document's name.
 */
@ExtendWith(MockitoExtension.class)
class ScriptResultDeserializerTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-1";
    private static final String SCRIPT_ID = "script-1";

    @Mock
    private ScriptExecutionRepository scriptExecutionRepository;
    @Mock
    private ScriptRepository scriptRepository;

    private final ObjectMapper mapper = new ObjectMapper();
    private ScriptResultDeserializer deserializer;

    @BeforeEach
    void setUp() {
        deserializer = new ScriptResultDeserializer(mapper, scriptExecutionRepository, scriptRepository);
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
    @DisplayName("getMessage: resolves the script name via the row's scriptId → Script document, producing \"Script <name> executed.\" — the format the History UI surfaces in the LogEvent summary")
    void getMessage_resolvesNameViaScript_returnsFormattedSummary() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 0);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptId(SCRIPT_ID)));
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID))
                .thenReturn(Optional.of(scriptWithName("disk usage")));

        assertThat(deserializer.getMessage(after)).contains("Script disk usage executed.");
    }

    @Test
    @DisplayName("getMessage: succeeds even when the script run FAILED (exitCode != 0) — message is about \"a script ran\", status lives elsewhere")
    void getMessage_alsoForFailedRuns() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 1);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptId(SCRIPT_ID)));
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID))
                .thenReturn(Optional.of(scriptWithName("disk usage")));

        // Format is invariant of outcome — the user-visible status badge is rendered separately.
        assertThat(deserializer.getMessage(after)).contains("Script disk usage executed.");
    }

    @Test
    @DisplayName("getMessage: no Execution row found → falls back to \"Script executed\" without attempting a Script lookup")
    void getMessage_rowMissing_fallsBackToGeneric() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.empty());

        assertThat(deserializer.getMessage(after)).contains("Script executed");
        verifyNoInteractions(scriptRepository);
    }

    @Test
    @DisplayName("getMessage: Execution row found but its Script is gone (hard-deleted) → falls back to generic, never null")
    void getMessage_scriptMissing_fallsBackToGeneric() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptId(SCRIPT_ID)));
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID))
                .thenReturn(Optional.empty());

        assertThat(deserializer.getMessage(after)).contains("Script executed");
    }

    @Test
    @DisplayName("getMessage: missing tenantId / executionId on the payload → fallback (no Mongo lookup attempted)")
    void getMessage_missingIdentifiers_fallsBackWithoutMongoCall() {
        ObjectNode after = mapper.createObjectNode().put("exitCode", 0);

        assertThat(deserializer.getMessage(after)).contains("Script executed");
        verifyNoInteractions(scriptExecutionRepository);
        verifyNoInteractions(scriptRepository);
    }

    @Test
    @DisplayName("getMessage: Mongo throws → caught silently, fallback returned — deserialize must NOT break the Kafka consumer thread")
    void getMessage_mongoFailure_fallsBackQuietly() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenThrow(new RuntimeException("Mongo down"));

        assertThat(deserializer.getMessage(after)).contains("Script executed");
    }

    @Test
    @DisplayName("getMessage: a blank/null name on the resolved Script (defensive) → fallback")
    void getMessage_blankScriptName_fallsBackToGeneric() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptId(SCRIPT_ID)));
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID))
                .thenReturn(Optional.of(scriptWithName("")));

        assertThat(deserializer.getMessage(after)).contains("Script executed");
    }

    @Test
    @DisplayName("getMessage: Execution row with a null scriptId (defensive) → fallback, no Script lookup")
    void getMessage_nullScriptId_fallsBackToGeneric() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptId(null)));

        assertThat(deserializer.getMessage(after)).contains("Script executed");
        verifyNoInteractions(scriptRepository);
    }

    private static ScriptExecution executionWithScriptId(String scriptId) {
        return ScriptExecution.builder().scriptId(scriptId).build();
    }

    private static Script scriptWithName(String name) {
        Script script = new Script();
        script.setName(name);
        return script;
    }
}
