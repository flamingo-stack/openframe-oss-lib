package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import com.openframe.data.nats.rmm.util.ScriptArgsTokenizer;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleFireDispatcher {

    private final ScheduleDeviceTargetResolver targetResolver;
    private final ScriptRepository scriptRepository;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    private final ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;
    private final MachineRepository machineRepository;
    private final DeviceOnlineDispatchRepository dispatchRepository;

    public void dispatch(ScheduleScript schedule, Instant now) {
        List<String> targets = targetResolver.resolveTargetMachineIds(schedule);
        if (isRetryOnReconnect(schedule)) {
            dispatchWithReconnectRetry(schedule, targets, now);
        } else {
            dispatch(schedule, targets, now);
        }
    }

    private boolean isRetryOnReconnect(ScheduleScript schedule) {
        return schedule.getTrigger() == ScheduleScriptTrigger.DATE_TIME
                && schedule.getOfflineBehavior() == ScheduleOfflineBehavior.RETRY_ON_RECONNECT
                && schedule.getReconnectWindowSeconds() != null
                && schedule.getReconnectWindowSeconds() > 0;
    }

    private void dispatchWithReconnectRetry(ScheduleScript schedule, List<String> targets, Instant now) {
        if (targets == null || targets.isEmpty()) {
            dispatch(schedule, targets, now);
            return;
        }
        Map<String, Machine> byId = machineRepository
                .findByTenantIdAndMachineIdIn(schedule.getTenantId(), new HashSet<>(targets)).stream()
                .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));

        List<String> toDispatch = new ArrayList<>();
        List<String> toHold = new ArrayList<>();
        for (String machineId : targets) {
            Machine machine = byId.get(machineId);
            if (machine != null && machine.getStatus() == DeviceStatus.OFFLINE) {
                toHold.add(machineId);      // genuinely offline → wait for reconnect
            } else {
                toDispatch.add(machineId);  // online / any non-OFFLINE state → dispatch as today
            }
        }

        if (!toHold.isEmpty()) {
            armReconnectRetry(schedule, toHold, now);
        }
        dispatch(schedule, toDispatch, now);
    }

    /**
     * Arm (or refresh) one reconnect-retry sentinel per offline device. Keyed by
     * (tenant, schedule, machine) — a later fire supersedes any stale sentinel by resetting it to
     * NEW with a fresh window, so the collection never grows unbounded.
     */
    private void armReconnectRetry(ScheduleScript schedule, List<String> machineIds, Instant now) {
        Instant expiresAt = now.plusSeconds(schedule.getReconnectWindowSeconds());
        for (String machineId : machineIds) {
            DeviceFirstOnlineDispatch row = dispatchRepository
                    .findByTenantIdAndMachineIdAndScheduleId(schedule.getTenantId(), machineId, schedule.getId())
                    .orElseGet(() -> DeviceFirstOnlineDispatch.builder()
                            .tenantId(schedule.getTenantId())
                            .machineId(machineId)
                            .scheduleId(schedule.getId())
                            .build());
            row.setStatus(DeviceOnlineDispatchStatus.NEW);
            row.setFirstSeenAt(now);
            row.setExpiresAt(expiresAt);
            row.setDispatchedAt(null);
            try {
                dispatchRepository.save(row);
            } catch (DuplicateKeyException raced) {
                log.debug("reconnect-retry sentinel armed concurrently: machineId={} scheduleId={}",
                        machineId, schedule.getId());
            }
        }
        log.info("Armed reconnect-retry for {} offline device(s) scheduleId={} tenantId={} expiresAt={}",
                machineIds.size(), schedule.getId(), schedule.getTenantId(), expiresAt);
    }

    /**
     * Dispatch one fire of {@code schedule} to a specific set of machines — used by the
     * DEVICE_ONLINE trigger, which fires only on the single machine that just came online.
     * The caller is responsible for the machines being genuinely assigned. No-op (logged) when
     * there is nothing to run.
     */
    public void dispatch(ScheduleScript schedule, List<String> machineIds, Instant now) {
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
                fire.scheduleId(), fire.executionId(), scripts.size(), machineIds.size());
    }

    private static Map<String, ScheduledScriptCustomParams> customParamsByScriptId(ScheduleScript schedule) {
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
                .executionId(fire.executionId())
                .scheduleId(fire.scheduleId())
                .initiatedBy(fire.initiatedBy())
                .status(ExecutionStatus.RUNNING)
                .totalMachineCount(fire.machineIds().size())
                .dispatchedAt(fire.now())
                .build());
    }

    /** One RUNNING leaf row per (script, machine); mirrors the api-lib dispatch. */
    private void saveLeafRows(Fire fire) {
        List<ScriptExecution> rows = fire.scripts().stream()
                .flatMap(script -> fire.machineIds().stream().map(machineId -> ScriptExecution.builder()
                        .tenantId(fire.tenantId())
                        .executionId(fire.executionId())
                        .scriptId(script.getId())
                        .scheduleId(fire.scheduleId())
                        .machineId(machineId)
                        .privilegeLevel(script.getPrivilegeLevel())
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .initiatedBy(fire.initiatedBy())
                        .source(ExecutionSource.SCHEDULED)
                        .status(ExecutionStatus.RUNNING)
                        .dispatchedAt(fire.now())
                        .statusChangedAt(fire.now())
                        .build()))
                .toList();
        scriptExecutionRepository.saveAll(rows);
    }

    /** Build the shared payload once, fan out ONE message per machine. */
    private void publish(Fire fire) {
        Map<String, ScheduledScriptCustomParams> customParamsByScriptId = customParamsByScriptId(fire.schedule());
        List<ScriptScheduleExecutionItem> items = fire.scripts().stream()
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

        fire.machineIds().forEach(machineId -> scriptScheduleNatsPublisher.publish(machineId,
                ScriptScheduleExecutionMessage.builder()
                        .executionId(fire.executionId())
                        .scheduleId(fire.scheduleId())
                        .machineId(machineId)
                        .initiatedBy(fire.initiatedBy())
                        .scripts(items)
                        .build()));
    }

    /** Everything one fire needs, bundled so the persist/publish steps take a single arg. */
    private record Fire(ScheduleScript schedule, String executionId, List<Script> scripts,
                        List<String> machineIds, Instant now) {
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
