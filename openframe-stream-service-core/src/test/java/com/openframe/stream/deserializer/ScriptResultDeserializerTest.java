package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.openframe.data.document.rmm.script.OsType;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ScriptCreationSource;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.software.SoftwareAction;
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

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptResultDeserializerTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-1";
    private static final String SCRIPT_ID = "script-1";

    @Mock
    private ScriptExecutionRepository scriptExecutionRepository;
    @Mock
    private ScriptRepository scriptRepository;

    private final ObjectMapper mapper = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build();
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
        assertThat(deserializer.getSourceEventType(mapper.createObjectNode().put("exitCode", 0)))
                .contains(SourceEventTypes.Rmm.SCRIPT_RUN_FINISHED);
    }

    @Test
    void sourceEventType_nonZeroExitCode_isScriptRunFailed() {
        // setup
        ObjectNode after = mapper.createObjectNode().put("exitCode", 1);

        // execution
        Optional<String> sourceEventType = deserializer.getSourceEventType(after);

        // verifications
        assertThat(sourceEventType).contains(SourceEventTypes.Rmm.SCRIPT_RUN_FAILED);
    }

    @Test
    void sourceEventType_timedOut_isScriptRunFailed() {
        // setup
        ObjectNode after = mapper.createObjectNode().put("exitCode", 0).put("timedOut", true);

        // execution
        Optional<String> sourceEventType = deserializer.getSourceEventType(after);

        // verifications
        assertThat(sourceEventType).contains(SourceEventTypes.Rmm.SCRIPT_RUN_FAILED);
    }

    @Test
    void sourceEventType_agentErrorWithoutExitCode_isScriptRunFailed() {
        // setup
        ObjectNode after = mapper.createObjectNode().put("error", "binary not found");

        // execution
        Optional<String> sourceEventType = deserializer.getSourceEventType(after);

        // verifications
        assertThat(sourceEventType).contains(SourceEventTypes.Rmm.SCRIPT_RUN_FAILED);
    }

    @Test
    void sourceEventType_stderrOnlyWithZeroExitCode_staysFinished() {
        // setup
        ObjectNode after = mapper.createObjectNode().put("exitCode", 0).put("stderr", "warning: deprecated flag");

        // execution
        Optional<String> sourceEventType = deserializer.getSourceEventType(after);

        // verifications
        assertThat(sourceEventType).contains(SourceEventTypes.Rmm.SCRIPT_RUN_FINISHED);
    }

    @Test
    @DisplayName("getEventToolId: appends scriptId so two scripts of one schedule run (shared executionId+machineId) get DISTINCT ids — the fix for the Cassandra/Pinot tool_event_id collision")
    void getEventToolId_appendsScriptId_distinguishesScriptsOfOneScheduleRun() {
        ObjectNode scriptA = mapper.createObjectNode()
                .put("executionId", EXECUTION_ID).put("machineId", "m-1").put("scriptId", "script-A");
        ObjectNode scriptB = mapper.createObjectNode()
                .put("executionId", EXECUTION_ID).put("machineId", "m-1").put("scriptId", "script-B");

        assertThat(deserializer.getEventToolId(scriptA)).contains(EXECUTION_ID + ":m-1:script-A");
        assertThat(deserializer.getEventToolId(scriptB)).contains(EXECUTION_ID + ":m-1:script-B");
        assertThat(deserializer.getEventToolId(scriptA)).isNotEqualTo(deserializer.getEventToolId(scriptB));
    }

    @Test
    @DisplayName("getEventToolId: no executionId AND no machineId → empty, so the base uses its content-hash fallback (distinct per event) rather than a shared \"::\" id Pinot would collapse across tenants")
    void getEventToolId_noExecutionIdentity_isEmptyForHashFallback() {
        // Even a lone scriptId is not an execution identity — must still defer to the hash fallback.
        ObjectNode scriptOnly = mapper.createObjectNode().put("scriptId", "script-A");

        assertThat(deserializer.getEventToolId(scriptOnly)).isEmpty();
        assertThat(deserializer.getEventToolId(mapper.createObjectNode())).isEmpty();
    }

    @Test
    @DisplayName("getEventToolId: an agent that does not echo scriptId still keys on exec:machine: — execution identity is preserved (trailing empty component), no collapse to the hash fallback")
    void getEventToolId_missingScriptId_keepsExecMachineComposite() {
        ObjectNode after = mapper.createObjectNode()
                .put("executionId", EXECUTION_ID).put("machineId", "m-1");

        assertThat(deserializer.getEventToolId(after)).contains(EXECUTION_ID + ":m-1:");
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
    void getMessage_failedRun_saysTheScriptFailed() {
        // setup
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 1);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(executionWithScriptId(SCRIPT_ID)));
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID))
                .thenReturn(Optional.of(scriptWithName("disk usage")));

        // execution
        Optional<String> message = deserializer.getMessage(after);

        // verifications
        assertThat(message).contains("Script disk usage failed.");
    }

    @Test
    void getMessage_failedRunWithoutIdentifiers_fallsBackToScriptFailed() {
        // setup
        ObjectNode after = mapper.createObjectNode().put("exitCode", 1);

        // execution
        Optional<String> message = deserializer.getMessage(after);

        // verifications
        assertThat(message).contains("Script failed");
        verifyNoInteractions(scriptExecutionRepository);
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

    @Test
    @DisplayName("getMessage: a software install row is labeled by its package (\"Installed slack.\"), not by the shared generic script")
    void getMessage_softwareInstall_labeledByPackage() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 0);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(softwareExecution("slack", SoftwareAction.INSTALL)));

        assertThat(deserializer.getMessage(after)).contains("Installed slack.");
        verifyNoInteractions(scriptRepository);
    }

    @Test
    @DisplayName("getMessage: a software update row reads \"Updated <package>.\"")
    void getMessage_softwareUpdate_labeledByPackage() {
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 0);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(softwareExecution("Mozilla.Firefox", SoftwareAction.UPDATE)));

        assertThat(deserializer.getMessage(after)).contains("Updated Mozilla.Firefox.");
        verifyNoInteractions(scriptRepository);
    }

    @Test
    void getMessage_softwareInstallFailed_labeledFailedToInstall() {
        // setup
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 1);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(softwareExecution("presentify", SoftwareAction.INSTALL)));

        // execution
        Optional<String> message = deserializer.getMessage(after);

        // verifications
        assertThat(message).contains("Failed to install presentify.");
        verifyNoInteractions(scriptRepository);
    }

    @Test
    void getMessage_softwareUpdateTimedOut_labeledFailedToUpdate() {
        // setup
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("exitCode", 0).put("timedOut", true);
        when(scriptExecutionRepository.findFirstByTenantIdAndExecutionId(TENANT_ID, EXECUTION_ID))
                .thenReturn(Optional.of(softwareExecution("Mozilla.Firefox", SoftwareAction.UPDATE)));

        // execution
        Optional<String> message = deserializer.getMessage(after);

        // verifications
        assertThat(message).contains("Failed to update Mozilla.Firefox.");
    }

    @Test
    @DisplayName("getResult: the whole script document is attached as input next to the output, minus content hash, null fields and secret values")
    void getResult_scriptFound_attachesScriptDocumentAsInput() throws Exception {
        // setup
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("executionId", EXECUTION_ID).put("scriptId", SCRIPT_ID)
                .put("stdout", "ok").put("exitCode", 0);
        Script script = Script.builder()
                .id(SCRIPT_ID).tenantId(TENANT_ID).name("Disk cleanup").shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.ADMIN).scriptBody("echo hi").supportedPlatforms(List.of(OsType.MAC_OS))
                .defaultTimeoutSeconds(300).defaultArgs(List.of("-a", "--verbose"))
                .envVars(List.of(new ScriptEnvVar("REGION", "eu", false), new ScriptEnvVar("API_KEY", "s3cr3t", true)))
                .createdBy("user-1").creationSource(ScriptCreationSource.AI_ASSISTANT)
                .createdAt(Instant.parse("2026-09-28T17:58:16.101Z")).contentHash("abc123")
                .build();
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.of(script));

        // execution
        JsonNode result = mapper.readTree(deserializer.getResult(after));

        // verifications
        assertThat(result.get("output").asText()).isEqualTo("ok");
        JsonNode input = result.get("input");
        assertThat(input.get("id").asText()).isEqualTo(SCRIPT_ID);
        assertThat(input.get("name").asText()).isEqualTo("Disk cleanup");
        assertThat(input.get("shell").asText()).isEqualTo("BASH");
        assertThat(input.get("privilegeLevel").asText()).isEqualTo("ADMIN");
        assertThat(input.get("scriptBody").asText()).isEqualTo("echo hi");
        assertThat(input.get("supportedPlatforms")).extracting(JsonNode::asText).containsExactly("MAC_OS");
        assertThat(input.get("defaultTimeoutSeconds").asInt()).isEqualTo(300);
        assertThat(input.get("defaultArgs")).extracting(JsonNode::asText).containsExactly("-a", "--verbose");
        assertThat(input.get("createdBy").asText()).isEqualTo("user-1");
        assertThat(input.get("creationSource").asText()).isEqualTo("AI_ASSISTANT");
        assertThat(input.get("createdAt").asText()).isEqualTo("2026-09-28T17:58:16.101Z");
        assertThat(input.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(input.has("contentHash")).isFalse();
        assertThat(input.has("description")).isFalse();
        assertThat(input.has("updatedAt")).isFalse();
        assertThat(input.get("envVars").get(0).get("value").asText()).isEqualTo("eu");
        JsonNode secret = input.get("envVars").get(1);
        assertThat(secret.get("name").asText()).isEqualTo("API_KEY");
        assertThat(secret.has("value")).isFalse();
        assertThat(secret.get("secret").asBoolean()).isTrue();
    }

    @Test
    @DisplayName("getResult: script gone → the base result is returned untouched")
    void getResult_scriptMissing_keepsBaseResult() throws Exception {
        // setup
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("scriptId", SCRIPT_ID).put("exitCode", 0);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenReturn(Optional.empty());

        // execution
        JsonNode result = mapper.readTree(deserializer.getResult(after));

        // verifications
        assertThat(result.get("exit_code").asInt()).isZero();
        assertThat(result.has("input")).isFalse();
    }

    @Test
    @DisplayName("getResult: no scriptId on the wire → no lookup, base result only")
    void getResult_noScriptIdOnWire_keepsBaseResult() throws Exception {
        // setup
        ObjectNode after = mapper.createObjectNode().put("tenantId", TENANT_ID).put("exitCode", 0);

        // execution
        JsonNode result = mapper.readTree(deserializer.getResult(after));

        // verifications
        assertThat(result.has("input")).isFalse();
        verifyNoInteractions(scriptRepository);
    }

    @Test
    @DisplayName("getResult: Mongo throws → the base result survives; deserialize must not break the consumer thread")
    void getResult_mongoFailure_keepsBaseResult() throws Exception {
        // setup
        ObjectNode after = mapper.createObjectNode()
                .put("tenantId", TENANT_ID).put("scriptId", SCRIPT_ID).put("exitCode", 0);
        when(scriptRepository.findByTenantIdAndId(TENANT_ID, SCRIPT_ID)).thenThrow(new IllegalStateException("mongo down"));

        // execution
        JsonNode result = mapper.readTree(deserializer.getResult(after));

        // verifications
        assertThat(result.get("exit_code").asInt()).isZero();
        assertThat(result.has("input")).isFalse();
    }

    @Test
    @DisplayName("getResult: a payload with nothing to record still yields null, as before, without a Mongo lookup")
    void getResult_nothingToRecord_null() {
        // setup
        ObjectNode after = mapper.createObjectNode();

        // execution
        String result = deserializer.getResult(after);

        // verifications
        assertThat(result).isNull();
        verifyNoInteractions(scriptRepository);
    }

    private static ScriptExecution executionWithScriptId(String scriptId) {
        return ScriptExecution.builder().scriptId(scriptId).build();
    }

    private static ScriptExecution softwareExecution(String packageName, SoftwareAction action) {
        return ScriptExecution.builder()
                .scriptId("generic-software-script")
                .packageName(packageName)
                .softwareAction(action)
                .build();
    }

    private static Script scriptWithName(String name) {
        Script script = new Script();
        script.setName(name);
        return script;
    }
}
