package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dispatches a <b>saved</b> script from the dashboard to the target agent over <b>core NATS</b>.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptDispatchService {

    private final ScriptService scriptService;
    private final ScriptNatsPublisher scriptNatsPublisher;
    private final DeviceService deviceService;

    public DispatchResponse runScript(RunScriptInput input) {
        // Target must be a real (tenant-scoped) machine — don't dispatch into the void.
        deviceService.findByMachineId(input.getMachineId())
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + input.getMachineId()));

        // Tenant-scoped lookup; throws if the script is missing or soft-deleted.
        ScriptResponse script = scriptService.get(input.getScriptId());
        String executionId = UUID.randomUUID().toString();

        ScriptMessage message = ScriptMessage.builder()
                .executionId(executionId)
                .scriptBody(script.getScriptBody())
                .shell(ScriptShell.valueOf(script.getShell()))
                .args(input.getArgs() != null ? input.getArgs() : script.getDefaultArgs())
                .envVars(mergeEnvVars(script.getEnvVars(), input.getEnvVars()))
                .privilegeLevel(input.getPrivilegeLevel())
                .timeout(input.getTimeoutSeconds() != null ? input.getTimeoutSeconds() : script.getDefaultTimeoutSeconds())
                .build();

        scriptNatsPublisher.publishScript(input.getMachineId(), message);

        log.info("Dispatched script executionId={} scriptId={} machineId={} shell={} privilegeLevel={}",
                executionId, input.getScriptId(), input.getMachineId(), script.getShell(), input.getPrivilegeLevel());
        return DispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    private Map<String, String> mergeEnvVars(List<ScriptEnvVarInput> base, List<ScriptEnvVarInput> overrides) {
        Map<String, String> merged = new LinkedHashMap<>();
        putEnvVars(merged, base);
        putEnvVars(merged, overrides);
        return merged.isEmpty() ? null : merged;
    }

    private static void putEnvVars(Map<String, String> target, List<ScriptEnvVarInput> envVars) {
        if (envVars == null) {
            return;
        }
        for (ScriptEnvVarInput e : envVars) {
            if (e.getName() != null) {
                target.put(e.getName(), e.getValue() == null ? "" : e.getValue());
            }
        }
    }
}
