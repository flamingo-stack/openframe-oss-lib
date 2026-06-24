package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.rmm.Execution;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.repository.rmm.ExecutionRepository;
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
    private static final String FALLBACK_MESSAGE = "Script executed";

    private final ExecutionRepository executionRepository;

    public ScriptResultDeserializer(ObjectMapper mapper, ExecutionRepository executionRepository) {
        super(mapper);
        this.executionRepository = executionRepository;
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
    protected Optional<String> getMessage(JsonNode after) {
        String scriptName = findScriptName(after);
        if (scriptName == null || scriptName.isBlank()) {
            return Optional.of(FALLBACK_MESSAGE);
        }
        return Optional.of("Script " + scriptName + " executed.");
    }

    private String findScriptName(JsonNode after) {
        try {
            String tenantId = parseStringField(after, FIELD_TENANT_ID).orElse(null);
            String executionId = parseStringField(after, FIELD_EXECUTION_ID).orElse(null);
            if (tenantId == null || executionId == null) {
                return null;
            }
            return executionRepository.findByTenantIdAndExecutionId(tenantId, executionId)
                    .map(Execution::getScriptName)
                    .orElse(null);
        } catch (Exception e) {
            log.warn("Failed to look up Execution for script-result message formatting", e);
            return null;
        }
    }
}
