package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.stream.mapping.SourceEventTypes;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

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
        return Optional.of(SourceEventTypes.Rmm.SCRIPT_RUN_FINISHED);
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
        try {
            String tenantId = parseStringField(after, FIELD_TENANT_ID).orElse(null);
            if (tenantId == null) {
                return Optional.of(FALLBACK_MESSAGE);
            }
            Optional<ScriptExecution> row = parseStringField(after, FIELD_EXECUTION_ID)
                    .flatMap(executionId -> scriptExecutionRepository.findFirstByTenantIdAndExecutionId(tenantId, executionId));

            Optional<String> packageMessage = row
                    .filter(r -> r.getPackageName() != null && !r.getPackageName().isBlank())
                    .map(ScriptResultDeserializer::softwareMessage);
            if (packageMessage.isPresent()) {
                return packageMessage;
            }

            String scriptName = resolveScriptName(after, tenantId, row.map(ScriptExecution::getScriptId).orElse(null));
            if (scriptName == null || scriptName.isBlank()) {
                return Optional.of(FALLBACK_MESSAGE);
            }
            return Optional.of("Script " + scriptName + " executed.");
        } catch (Exception e) {
            log.warn("Failed to build script-result message", e);
            return Optional.of(FALLBACK_MESSAGE);
        }
    }

    private static String softwareMessage(ScriptExecution row) {
        String verb = row.getSoftwareAction() == SoftwareAction.UPDATE ? "Updated" : "Installed";
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
