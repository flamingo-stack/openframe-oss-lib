package com.openframe.api.service.rmm;

import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.script.BatchRunScriptInput;
import com.openframe.api.dto.rmm.script.RunScriptInput;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.service.DeviceService;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import com.openframe.data.nats.rmm.util.ScriptArgsTokenizer;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

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
@ConditionalOnProperty("spring.cloud.stream.enabled")
@RequiredArgsConstructor
public class ScriptDispatchService {

    private final ScriptService scriptService;
    private final ScriptNatsPublisher scriptNatsPublisher;
    private final ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;
    private final DeviceService deviceService;
    private final ScriptExecutionService scriptExecutionService;
    private final ScriptScheduleService scriptScheduleService;
    private final ScriptScheduleDeviceService scriptScheduleDeviceService;
    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    private final TenantIdProvider tenantIdProvider;

    public DispatchResponse runScript(RunScriptInput input, String initiatedBy) {
        deviceService.findByMachineId(input.getMachineId())
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + input.getMachineId()));

        // Tenant-scoped lookup; throws if the script is missing or soft-deleted.
        ScriptResponse script = scriptService.get(input.getScriptId());
        String executionId = UUID.randomUUID().toString();
        Integer timeoutSeconds = effectiveTimeout(input.getTimeoutSeconds(), script.getDefaultTimeoutSeconds());

        // Persist the effective timeout on the row so the watchdog can derive a
        // per-execution stuck-threshold from it.
        scriptExecutionService.create(executionId, script.getId(),
                input.getMachineId(), input.getPrivilegeLevel(), timeoutSeconds, initiatedBy);

        ScriptMessage message = ScriptMessage.builder()
                .executionId(executionId)
                .scriptId(script.getId())
                .machineId(input.getMachineId())
                .code(script.getScriptBody())
                .shell(ScriptShell.valueOf(script.getShell()))
                .privilegeLevel(input.getPrivilegeLevel())
                .args(ScriptArgsTokenizer.tokenize(input.getArgs() != null ? input.getArgs() : script.getDefaultArgs()))
                .timeoutSeconds(timeoutSeconds)
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
        verifyMachines(machineIds);

        // Resolve the saved script once; every machine shares it.
        ScriptResponse script = scriptService.get(input.getScriptId());
        String executionId = UUID.randomUUID().toString();

        return dispatchBatch(executionId, script, machineIds, input.getPrivilegeLevel(),
                input.getArgs(), input.getTimeoutSeconds(), input.getEnvVars(), initiatedBy);
    }

    /**
     * Ad-hoc run of a saved schedule: fan every ACTIVE script the schedule references out
     * to every assigned device over core NATS as ONE
     * {@link ScriptScheduleExecutionMessage} per machine (the whole script list is
     * batched into a single wire payload — subject
     * {@code machine.{machineId}.script-schedule-execution}). The whole run shares a
     * single {@code executionId} across all scripts and machines; each leaf
     * {@code ScriptExecution} row is disambiguated by {@code scriptId} and the header
     * {@link ScheduleScriptExecution} record ties them all together.
     *
     * <p>Only ACTIVE scripts are dispatched; scripts the schedule has outlived
     * (deleted/archived) are skipped, not fatal. Throws {@link BadRequestException} only
     * when there is genuinely nothing to run — no scripts, no assigned devices, or none
     * of the referenced scripts are runnable — so we never mint a hollow executionId that
     * correlates to no execution rows.
     */
    public DispatchResponse runSchedule(String scheduleId, String initiatedBy) {
        // Tenant-scoped lookup; throws if the schedule is missing or soft-deleted.
        ScriptScheduleResponse schedule = scriptScheduleService.get(scheduleId);

        List<String> scriptIds = schedule.getScriptIds();
        if (scriptIds == null || scriptIds.isEmpty()) {
            throw new BadRequestException("Schedule has no scripts to run: " + scheduleId);
        }

        List<String> machineIds = scriptScheduleDeviceService.getMachineIds(scheduleId);
        if (machineIds.isEmpty()) {
            throw new BadRequestException("Schedule has no assigned devices: " + scheduleId);
        }

        // Verify every target up front — reject the whole run if any is unknown,
        // so we never half-dispatch across the schedule's scripts.
        verifyMachines(machineIds);

        // Resolve every referenced script in ONE query (no N+1). Only ACTIVE scripts are
        // dispatched; a schedule can outlive some of its scripts (deleted/archived), and
        // those are skipped rather than failing the run.
        Map<String, ScriptResponse> scriptsById = scriptService.getScriptsByIds(scriptIds).stream()
                .filter(script -> ScriptStatus.ACTIVE.name().equals(script.getStatus()))
                .collect(Collectors.toMap(ScriptResponse::getId, Function.identity(), (a, b) -> a));

        // Preserve run order; dedup (a shared executionId can't carry the same
        // scriptId twice on one machine — the leaf unique key would collide).
        List<ScriptResponse> runnableScripts = scriptIds.stream().distinct()
                .map(scriptsById::get).filter(java.util.Objects::nonNull).toList();
        List<String> skippedIds = scriptIds.stream().distinct().filter(id -> !scriptsById.containsKey(id)).toList();
        if (!skippedIds.isEmpty()) {
            log.warn("Schedule run scheduleId={} skipping non-runnable scripts (missing/deleted/archived): {}",
                    scheduleId, skippedIds);
        }
        if (runnableScripts.isEmpty()) {
            throw new BadRequestException("Schedule has no runnable scripts: " + scheduleId);
        }

        String executionId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        List<String> runnableScriptIds = runnableScripts.stream().map(ScriptResponse::getId).toList();

        // 1. Header: one ScheduleScriptExecution row per fire — snapshot of what was
        //    attempted. Persisted BEFORE the leaves + NATS publish so the fact of the fire
        //    is durably recorded even if downstream persistence/publish fails midway.
        scheduleScriptExecutionRepository.save(ScheduleScriptExecution.builder()
                .tenantId(tenantIdProvider.getTenantId())
                .executionId(executionId)
                .scheduleId(scheduleId)
                .initiatedBy(initiatedBy)
                .scriptIds(runnableScriptIds)
                .machineIds(machineIds)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(now)
                .build());

        // 2. Leaves: N × M ScriptExecution rows (persist per-script batch), so the watchdog
        //    and per-(script, machine) history keep working exactly as before.
        for (ScriptResponse script : runnableScripts) {
            scriptExecutionService.createBatch(executionId, script.getId(), scheduleId, machineIds,
                    script.getPrivilegeLevel(),
                    effectiveTimeout(null, script.getDefaultTimeoutSeconds()),
                    initiatedBy);
        }

        // 3. Build the batched agent payload once — shared across every target machine.
        List<ScriptScheduleExecutionItem> scheduledScripts = runnableScripts.stream()
                .map(script -> ScriptScheduleExecutionItem.builder()
                        .scriptId(script.getId())
                        .code(script.getScriptBody())
                        .shell(ScriptShell.valueOf(script.getShell()))
                        .privilegeLevel(script.getPrivilegeLevel())
                        .args(ScriptArgsTokenizer.tokenize(script.getDefaultArgs()))
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .envVars(mergeEnvVars(script.getEnvVars(), null))
                        .build())
                .toList();

        // 4. Fan out: ONE message per machine (vs. the old N-per-machine). subject:
        //    machine.{machineId}.script-schedule-execution.
        machineIds.forEach(machineId -> scriptScheduleNatsPublisher.publish(machineId,
                ScriptScheduleExecutionMessage.builder()
                        .executionId(executionId)
                        .scheduleId(scheduleId)
                        .machineId(machineId)
                        .initiatedBy(initiatedBy)
                        .scripts(scheduledScripts)
                        .build()));

        log.info("Dispatched schedule run scheduleId={} executionId={} scripts={} machines={}",
                scheduleId, executionId, runnableScripts.size(), machineIds.size());
        return DispatchResponse.builder().executionId(executionId).build();
    }

    private DispatchResponse dispatchBatch(String executionId, ScriptResponse script, List<String> machineIds,
                                           PrivilegeLevel privilegeLevel, List<String> argsOverride,
                                           Integer timeoutOverride, List<ScriptEnvVarInput> envVarsOverride,
                                           String initiatedBy) {
        Integer timeoutSeconds = effectiveTimeout(timeoutOverride, script.getDefaultTimeoutSeconds());

        // Persist the effective timeout per row so the watchdog can derive a
        // per-execution stuck-threshold from it.
        scriptExecutionService.createBatch(executionId, script.getId(), null, machineIds, privilegeLevel, timeoutSeconds, initiatedBy);

        ScriptShell shell = ScriptShell.valueOf(script.getShell());
        List<String> args = ScriptArgsTokenizer.tokenize(argsOverride != null ? argsOverride : script.getDefaultArgs());
        List<ScriptEnvVar> envVars = mergeEnvVars(script.getEnvVars(), envVarsOverride);

        // Fan out the same script (shared executionId) to every machine.
        machineIds.forEach(machineId -> scriptNatsPublisher.publishScript(machineId,
                ScriptMessage.builder()
                        .executionId(executionId)
                        .scriptId(script.getId())
                        .machineId(machineId)
                        .code(script.getScriptBody())
                        .shell(shell)
                        .privilegeLevel(privilegeLevel)
                        .args(args)
                        .timeoutSeconds(timeoutSeconds)
                        .envVars(envVars)
                        .build()));

        log.info("Dispatched batch script executionId={} scriptId={} machines={} shell={} privilegeLevel={}",
                executionId, script.getId(), machineIds.size(), script.getShell(), privilegeLevel);
        return DispatchResponse.builder()
                .executionId(executionId)
                .build();
    }

    private void verifyMachines(List<String> machineIds) {
        machineIds.forEach(machineId -> deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new DeviceNotFoundException("Machine not found: " + machineId)));
    }

    private static Integer effectiveTimeout(Integer override, Integer scriptDefault) {
        return override != null ? override : scriptDefault;
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
