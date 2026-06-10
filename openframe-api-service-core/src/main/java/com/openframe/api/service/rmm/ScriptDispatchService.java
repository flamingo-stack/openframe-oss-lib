package com.openframe.api.service.rmm;

import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptDispatchResponse;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Dispatches a <b>saved</b> script from the dashboard to the target agent over <b>core NATS</b>.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptDispatchService {

    private final ScriptService scriptService;
    private final ScriptNatsPublisher scriptNatsPublisher;

    public ScriptDispatchResponse runScript(RunScriptInput input) {
        // Tenant-scoped lookup; throws if the script is missing or soft-deleted.
        ScriptResponse script = scriptService.get(input.getScriptId());
        String executionId = UUID.randomUUID().toString();

        ScriptMessage message = ScriptMessage.builder()
                .executionId(executionId)
                .scriptBody(script.getScriptBody())
                .shell(ScriptShell.valueOf(script.getShell()))
                .args(input.getArgs() != null ? input.getArgs() : script.getDefaultArgs())
                .envVars(toEnvMap(script.getEnvVars()))
                .privilegeLevel(input.getPrivilegeLevel())
                .timeout(input.getTimeoutSeconds() != null ? input.getTimeoutSeconds() : script.getDefaultTimeoutSeconds())
                .build();

        scriptNatsPublisher.publishScript(input.getMachineId(), message);

        log.info("Dispatched script executionId={} scriptId={} machineId={} shell={} privilegeLevel={}",
                executionId, input.getScriptId(), input.getMachineId(), script.getShell(), input.getPrivilegeLevel());
        return ScriptDispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    private Map<String, String> toEnvMap(List<ScriptEnvVarInput> envVars) {
        if (envVars == null || envVars.isEmpty()) {
            return null;
        }
        return envVars.stream()
                .filter(e -> e.getName() != null)
                .collect(Collectors.toMap(
                        ScriptEnvVarInput::getName,
                        e -> e.getValue() == null ? "" : e.getValue(),
                        (a, b) -> b));
    }
}
