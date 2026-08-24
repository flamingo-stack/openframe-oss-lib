package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.ExecutionSource;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import com.openframe.data.nats.rmm.util.ScriptArgsTokenizer;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Dispatches one fire of a schedule; split out of the orchestrator to keep run mechanics apart from cadence bookkeeping.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleFireDispatcher {

    private final ScheduleDeviceTargetResolver targetResolver;
    private final ScriptRepository scriptRepository;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    private final ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;

    /**
     * Dispatch one fire of {@code schedule} to <b>all</b> its current target devices (the
     * time-driven runner path). Targets are resolved per the schedule's selection mode — explicit
     * assignments for SPECIFIC, the live criteria match for CRITERIA
     */
    public void dispatch(ScriptSchedule schedule, Instant now) {
        dispatch(schedule, targetResolver.resolveTargetMachineIds(schedule), now);
    }

    /**
     * Dispatch one fire of {@code schedule} to a specific set of machines — used by the
     * DEVICE_ONLINE trigger, which fires only on the single machine that just came online.
     * The caller is responsible for the machines being genuinely assigned. No-op (logged) when
     * there is nothing to run.
     */
    public void dispatch(ScriptSchedule schedule, List<String> machineIds, Instant now) {
        List<String> scriptIds = schedule.getScriptIds();
        if (scriptIds == null || scriptIds.isEmpty() || machineIds == null || machineIds.isEmpty()) {
            log.info("Schedule scheduleId={} has no scripts or no target devices — nothing dispatched",
                    schedule.getId());
            return;
        }

        List<Script> scripts = resolveRunnableScripts(schedule.getTenantId(), scriptIds);
        if (scripts.isEmpty()) {
            log.warn("Schedule scheduleId={} has no runnable scripts (all missing/inactive) — nothing dispatched",
                    schedule.getId());
            return;
        }

        // One executionId for the whole fire, shared across every script and machine.
        Fire fire = new Fire(schedule, UUID.randomUUID().toString(), scripts, machineIds, now);
        saveHeader(fire);
        saveLeafRows(fire);
        publish(fire);

        log.info("Dispatched schedule fire scheduleId={} executionId={} scripts={} machines={}",
                fire.scheduleId(), fire.getExecutionId(), scripts.size(), machineIds.size());
    }

    private static Map<String, ScheduledScriptCustomParams> customParamsByScriptId(ScriptSchedule schedule) {
        List<ScheduledScriptCustomParams> customParams = schedule.getScriptCustomParams();
        if (customParams == null || customParams.isEmpty()) {
            return Map.of();
        }
        return customParams.stream()
                .filter(cp -> cp.getScriptId() != null)
                .collect(Collectors.toMap(ScheduledScriptCustomParams::getScriptId, Function.identity(), (a, b) -> b));
    }

    /**
     * The schedule's runnable scripts, in its stored order: resolved once, ACTIVE only,
     * deduped, with missing/inactive ids dropped.
     */
    private List<Script> resolveRunnableScripts(String tenantId, List<String> scriptIds) {
        Map<String, Script> byId = scriptRepository.findByTenantIdAndIdIn(tenantId, scriptIds).stream()
                .filter(s -> s.getStatus() == ScriptStatus.ACTIVE)
                .collect(Collectors.toMap(Script::getId, Function.identity(), (a, b) -> a));
        return scriptIds.stream().distinct().map(byId::get).filter(Objects::nonNull).toList();
    }

    private void saveHeader(Fire fire) {
        scheduleScriptExecutionRepository.save(ScheduleScriptExecution.builder()
                .tenantId(fire.tenantId())
                .executionId(fire.getExecutionId())
                .scheduleId(fire.scheduleId())
                .initiatedBy(fire.initiatedBy())
                .status(ExecutionStatus.RUNNING)
                .totalMachineCount(fire.getMachineIds().size())
                .dispatchedAt(fire.getNow())
                .build());
    }

    /** One RUNNING leaf row per (script, machine); mirrors the api-lib dispatch. */
    private void saveLeafRows(Fire fire) {
        List<ScriptExecution> rows = fire.getScripts().stream()
                .flatMap(script -> fire.getMachineIds().stream().map(machineId -> ScriptExecution.builder()
                        .tenantId(fire.tenantId())
                        .executionId(fire.getExecutionId())
                        .scriptId(script.getId())
                        .scheduleId(fire.scheduleId())
                        .machineId(machineId)
                        .privilegeLevel(script.getPrivilegeLevel())
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .initiatedBy(fire.initiatedBy())
                        .source(ExecutionSource.SCHEDULED)
                        .status(ExecutionStatus.RUNNING)
                        .dispatchedAt(fire.getNow())
                        .statusChangedAt(fire.getNow())
                        .build()))
                .toList();
        scriptExecutionRepository.saveAll(rows);
    }

    /** Build the shared payload once, fan out ONE message per machine. */
    private void publish(Fire fire) {
        Map<String, ScheduledScriptCustomParams> customParamsByScriptId = customParamsByScriptId(fire.getSchedule());
        List<ScriptScheduleExecutionItem> items = fire.getScripts().stream()
                .map(script -> {
                    ScheduledScriptCustomParams cp = customParamsByScriptId.get(script.getId());
                    List<String> effectiveArgs = cp != null && cp.getArgs() != null ? cp.getArgs() : script.getDefaultArgs();
                    List<ScriptEnvVar> effectiveEnv = cp != null && cp.getEnvVars() != null ? cp.getEnvVars() : script.getEnvVars();

                    return ScriptScheduleExecutionItem.builder()
                            .scriptId(script.getId())
                            .code(script.getScriptBody())
                            .shell(script.getShell())
                            .privilegeLevel(script.getPrivilegeLevel())
                            .args(ScriptArgsTokenizer.tokenize(effectiveArgs))
                            .timeoutSeconds(script.getDefaultTimeoutSeconds())
                            .envVars(effectiveEnv)
                            .build();
                })
                .toList();

        fire.getMachineIds().forEach(machineId -> scriptScheduleNatsPublisher.publish(machineId,
                ScriptScheduleExecutionMessage.builder()
                        .executionId(fire.getExecutionId())
                        .scheduleId(fire.scheduleId())
                        .machineId(machineId)
                        .initiatedBy(fire.initiatedBy())
                        .scripts(items)
                        .build()));
    }

    /** Everything one fire needs, bundled so the persist/publish steps take a single arg. */
    @Getter
    @AllArgsConstructor
    private static class Fire {
        private final ScriptSchedule schedule;
        private final String executionId;
        private final List<Script> scripts;
        private final List<String> machineIds;
        private final Instant now;

        String tenantId() {
            return schedule.getTenantId();
        }

        String scheduleId() {
            return schedule.getId();
        }

        String initiatedBy() {
            return schedule.getCreatedBy();
        }
    }
}
