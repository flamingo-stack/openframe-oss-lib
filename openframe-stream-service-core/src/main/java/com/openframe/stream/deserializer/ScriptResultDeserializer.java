package com.openframe.stream.deserializer;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.stream.mapping.SourceEventTypes;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Binds the shared {@link RmmResultDeserializer} logic to
 * {@link MessageType#SCRIPT_EXECUTED} — results of saved-script executions.
 */
@Component
@Slf4j
public final class ScriptResultDeserializer extends RmmResultDeserializer {

    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_EXECUTION_ID = "executionId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_SCRIPT_ID = "scriptId";
    private static final String FALLBACK_MESSAGE = "Script executed";
    private static final String FALLBACK_FAILED_MESSAGE = "Script failed";

    private static final String DETAILS_INPUT = "input";
    private static final List<String> SCRIPT_FIELDS_LEFT_OUT = List.of("id", "tenantId", "contentHash");
    private static final String SCRIPT_ENV_VARS = "envVars";
    private static final String ENV_VAR_VALUE = "value";
    private static final String ENV_VAR_SECRET = "secret";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScriptRepository scriptRepository;
    private final ObjectMapper scriptMapper;

    public ScriptResultDeserializer(ObjectMapper mapper,
                                    ScriptExecutionRepository scriptExecutionRepository,
                                    ScriptRepository scriptRepository) {
        super(mapper);
        this.scriptExecutionRepository = scriptExecutionRepository;
        this.scriptRepository = scriptRepository;
        this.scriptMapper = mapper.copy().setSerializationInclusion(JsonInclude.Include.NON_NULL);
    }

    @Override
    public MessageType getType() {
        return MessageType.SCRIPT_EXECUTED;
    }

    @Override
    protected Optional<String> getSourceEventType(JsonNode after) {
        return Optional.of(isFailed(after) ? SourceEventTypes.Rmm.SCRIPT_RUN_FAILED : SourceEventTypes.Rmm.SCRIPT_RUN_FINISHED);
    }

    @Override
    protected Optional<String> getEventToolId(JsonNode after) {
        String executionId = parseStringField(after, FIELD_EXECUTION_ID).orElse(null);
        String machineId = parseStringField(after, FIELD_MACHINE_ID).orElse(null);
        if (executionId == null && machineId == null) {
            return Optional.empty();
        }
        String scriptId = parseStringField(after, FIELD_SCRIPT_ID).orElse(null);
        return Optional.of(String.join(":",
                executionId == null ? "" : executionId,
                machineId == null ? "" : machineId,
                scriptId == null ? "" : scriptId));
    }

    @Override
    protected Optional<String> getMessage(JsonNode after) {
        boolean failed = isFailed(after);
        String fallback = failed ? FALLBACK_FAILED_MESSAGE : FALLBACK_MESSAGE;
        try {
            String tenantId = parseStringField(after, FIELD_TENANT_ID).orElse(null);
            if (tenantId == null) {
                return Optional.of(fallback);
            }
            Optional<ScriptExecution> row = parseStringField(after, FIELD_EXECUTION_ID)
                    .flatMap(executionId -> scriptExecutionRepository.findFirstByTenantIdAndExecutionId(tenantId, executionId));

            Optional<String> packageMessage = row
                    .filter(r -> r.getPackageName() != null && !r.getPackageName().isBlank())
                    .map(r -> softwareMessage(r, failed));
            if (packageMessage.isPresent()) {
                return packageMessage;
            }

            String scriptName = resolveScriptName(after, tenantId, row.map(ScriptExecution::getScriptId).orElse(null));
            if (scriptName == null || scriptName.isBlank()) {
                return Optional.of(fallback);
            }
            return Optional.of("Script " + scriptName + (failed ? " failed." : " executed."));
        } catch (Exception e) {
            log.warn("Failed to build script-result message", e);
            return Optional.of(fallback);
        }
    }

    // The result block carries the script document as stored next to the output, without its id, tenant id,
    // content hash, null fields and the values of secret env vars; logs never hold a secret.
    @Override
    protected String getResult(JsonNode after) {
        String baseResult = super.getResult(after);
        try {
            ObjectNode result = toObjectNode(baseResult);
            findScript(after).ifPresent(script -> result.set(DETAILS_INPUT, inputOf(script)));
            return result.isEmpty() ? null : mapper.writeValueAsString(result);
        } catch (Exception e) {
            log.warn("Failed to attach the script input to the script-result block", e);
            return baseResult;
        }
    }

    private Optional<Script> findScript(JsonNode after) {
        String tenantId = parseStringField(after, FIELD_TENANT_ID).orElse(null);
        String scriptId = parseStringField(after, FIELD_SCRIPT_ID).orElse(null);
        if (tenantId == null || scriptId == null) {
            return Optional.empty();
        }
        return scriptRepository.findByTenantIdAndId(tenantId, scriptId);
    }

    private ObjectNode inputOf(Script script) {
        ObjectNode input = scriptMapper.valueToTree(script);
        input.remove(SCRIPT_FIELDS_LEFT_OUT);
        JsonNode envVars = input.path(SCRIPT_ENV_VARS);
        envVars.forEach(ScriptResultDeserializer::dropSecretValue);
        return input;
    }

    private static void dropSecretValue(JsonNode envVar) {
        boolean secret = envVar.path(ENV_VAR_SECRET).asBoolean();
        if (secret && envVar.isObject()) {
            ((ObjectNode) envVar).remove(ENV_VAR_VALUE);
        }
    }

    private static String softwareMessage(ScriptExecution row, boolean failed) {
        boolean update = row.getSoftwareAction() == SoftwareAction.UPDATE;
        String verb = failed
                ? (update ? "Failed to update" : "Failed to install")
                : (update ? "Updated" : "Installed");
        return verb + " " + row.getPackageName() + ".";
    }

    private String resolveScriptName(JsonNode after, String tenantId, String rowScriptId) {
        String scriptId = parseStringField(after, FIELD_SCRIPT_ID).orElse(rowScriptId);
        if (scriptId == null || scriptId.isBlank()) {
            return null;
        }
        return scriptRepository.findByTenantIdAndId(tenantId, scriptId)
                .map(Script::getName)
                .orElse(null);
    }
}
