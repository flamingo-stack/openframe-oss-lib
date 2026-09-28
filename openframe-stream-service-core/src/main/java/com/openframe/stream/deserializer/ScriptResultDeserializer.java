package com.openframe.stream.deserializer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.document.rmm.script.ScriptShell;
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
    private static final String DETAILS_SHELL = "shell";
    private static final String DETAILS_PRIVILEGE_LEVEL = "privilege_level";
    private static final String DETAILS_TIMEOUT_SECONDS = "timeout_seconds";
    private static final String DETAILS_ARGS = "args";
    private static final String DETAILS_ENV_VARS = "env_vars";
    private static final String DETAILS_NAME = "name";
    private static final String DETAILS_VALUE = "value";
    private static final String DETAILS_SECRET = "secret";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScriptRepository scriptRepository;

    public ScriptResultDeserializer(ObjectMapper mapper,
                                    ScriptExecutionRepository scriptExecutionRepository,
                                    ScriptRepository scriptRepository) {
        super(mapper);
        this.scriptExecutionRepository = scriptExecutionRepository;
        this.scriptRepository = scriptRepository;
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

    // The result block carries the script's stored input next to the output: shell, privilege level, default
    // timeout, default args and env vars. A secret env var keeps its name only; logs never hold its value.
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

    private ObjectNode toObjectNode(String json) throws JsonProcessingException {
        if (json == null) {
            return mapper.createObjectNode();
        }
        JsonNode parsed = mapper.readTree(json);
        return parsed.isObject() ? (ObjectNode) parsed : mapper.createObjectNode();
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
        ObjectNode input = mapper.createObjectNode();
        ScriptShell shell = script.getShell();
        putIfPresent(input, DETAILS_SHELL, shell == null ? null : shell.name());
        PrivilegeLevel privilegeLevel = script.getPrivilegeLevel();
        putIfPresent(input, DETAILS_PRIVILEGE_LEVEL, privilegeLevel == null ? null : privilegeLevel.name());
        putIfPresent(input, DETAILS_TIMEOUT_SECONDS, script.getDefaultTimeoutSeconds());
        List<String> args = script.getDefaultArgs();
        if (args != null) {
            ArrayNode argsNode = input.putArray(DETAILS_ARGS);
            args.forEach(argsNode::add);
        }
        List<ScriptEnvVar> envVars = script.getEnvVars();
        if (envVars != null) {
            ArrayNode envVarsNode = input.putArray(DETAILS_ENV_VARS);
            envVars.forEach(envVar -> envVarsNode.add(envVarOf(envVar)));
        }
        return input;
    }

    private ObjectNode envVarOf(ScriptEnvVar envVar) {
        ObjectNode node = mapper.createObjectNode();
        boolean secret = envVar.isSecret();
        node.put(DETAILS_NAME, envVar.getName());
        node.put(DETAILS_VALUE, secret ? null : envVar.getValue());
        node.put(DETAILS_SECRET, secret);
        return node;
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
