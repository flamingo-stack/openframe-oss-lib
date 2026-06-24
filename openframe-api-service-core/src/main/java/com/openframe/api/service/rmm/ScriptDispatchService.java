package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.script.BatchRunScriptInput;
import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dispatches a <b>saved</b> script from the dashboard to the target agent over <b>core NATS</b>.
 *
 * <p>{@code executionId} is generated server-side and returned to the dashboard so it
 * can correlate the asynchronous agent result. The id is intentionally NOT placed
 * inside the agent-bound {@link ScriptMessage} wire payload — the agent does not
 * need it to execute the script and the result-side correlation lives on a separate
 * channel.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScriptDispatchService {

    private final ScriptService scriptService;
    private final ScriptNatsPublisher scriptNatsPublisher;
    private final DeviceService deviceService;
    private final ExecutionService executionService;

    public DispatchResponse runScript(RunScriptInput input, String initiatedBy) {
        deviceService.findByMachineId(input.getMachineId())
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + input.getMachineId()));

        // Tenant-scoped lookup; throws if the script is missing or soft-deleted.
        ScriptResponse script = scriptService.get(input.getScriptId());
        String executionId = UUID.randomUUID().toString();

        executionService.create(executionId, script.getId(), script.getName(),
                input.getMachineId(), input.getPrivilegeLevel(), initiatedBy);

        ScriptMessage message = ScriptMessage.builder()
                .executionId(executionId)
                .machineId(input.getMachineId())
                .code(script.getScriptBody())
                .shell(ScriptShell.valueOf(script.getShell()))
                .privilegeLevel(input.getPrivilegeLevel())
                .args(input.getArgs() != null ? input.getArgs() : script.getDefaultArgs())
                .timeoutSeconds(input.getTimeoutSeconds() != null
                        ? input.getTimeoutSeconds()
                        : script.getDefaultTimeoutSeconds())
                .envVars(mergeEnvVars(script.getEnvVars(), input.getEnvVars()))
                .build();

        scriptNatsPublisher.publishScript(input.getMachineId(), message);

        log.info("Dispatched script executionId={} scriptId={} machineId={} shell={} privilegeLevel={}",
                executionId, input.getScriptId(), input.getMachineId(), script.getShell(), input.getPrivilegeLevel());
        return DispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    public DispatchResponse batchRunScript(BatchRunScriptInput input, String initiatedBy) {
        List<String> machineIds = input.getMachineIds().stream().distinct().toList();

        // Verify every target up front — reject the whole batch if any is unknown,
        // so we never half-dispatch.
        machineIds.forEach(machineId -> deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + machineId)));

        // Resolve the saved script once; every machine shares it.
        ScriptResponse script = scriptService.get(input.getScriptId());
        String executionId = UUID.randomUUID().toString();

        executionService.createBatch(executionId, script.getId(), script.getName(),
                machineIds, input.getPrivilegeLevel(), initiatedBy);

        ScriptShell shell = ScriptShell.valueOf(script.getShell());
        List<String> args = input.getArgs() != null ? input.getArgs() : script.getDefaultArgs();
        Integer timeoutSeconds = input.getTimeoutSeconds() != null
                ? input.getTimeoutSeconds()
                : script.getDefaultTimeoutSeconds();
        List<ScriptEnvVar> envVars = mergeEnvVars(script.getEnvVars(), input.getEnvVars());

        // Fan out the same script (one executionId) to every machine.
        machineIds.forEach(machineId -> scriptNatsPublisher.publishScript(machineId,
                ScriptMessage.builder()
                        .executionId(executionId)
                        .machineId(machineId)
                        .code(script.getScriptBody())
                        .shell(shell)
                        .privilegeLevel(input.getPrivilegeLevel())
                        .args(args)
                        .timeoutSeconds(timeoutSeconds)
                        .envVars(envVars)
                        .build()));

        log.info("Dispatched batch script executionId={} scriptId={} machines={} shell={} privilegeLevel={}",
                executionId, input.getScriptId(), machineIds.size(), script.getShell(), input.getPrivilegeLevel());
        return DispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    private List<ScriptEnvVar> mergeEnvVars(List<ScriptEnvVarInput> base, List<ScriptEnvVarInput> overrides) {
        Map<String, ScriptEnvVar> byName = new LinkedHashMap<>();
        putEnvVars(byName, base);
        putEnvVars(byName, overrides);
        return byName.isEmpty() ? null : new ArrayList<>(byName.values());
    }

    private static void putEnvVars(Map<String, ScriptEnvVar> target, List<ScriptEnvVarInput> envVars) {
        if (envVars == null) {
            return;
        }
        for (ScriptEnvVarInput e : envVars) {
            if (e.getName() != null) {
                target.put(e.getName(), ScriptEnvVar.builder()
                        .name(e.getName())
                        .value(e.getValue() == null ? "" : e.getValue())
                        .secret(e.isSecret())
                        .build());
            }
        }
    }
}
