package com.openframe.management.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleExecutionNatsPublisher;
import com.openframe.data.nats.rmm.util.ScriptArgsTokenizer;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
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
 * Dispatches ONE fire of a schedule: resolves what to run and where, records it, and fans it
 * out over core NATS. Split out of the orchestrator so the "run the scripts" mechanics live
 * apart from the "when to run + advance the cadence" bookkeeping.
 *
 * <p>A single fire produces (in order): one {@link ScheduleScriptExecution} header row
 * (a snapshot of the whole attempt), one {@link ScriptExecution} leaf row per (script, machine)
 * in {@code RUNNING} (persisted before publish so the watchdog can reap it), and one batched
 * {@link ScriptScheduleExecutionMessage} per machine on
 * {@code machine.{machineId}.script-schedule-execution}. Everything shares one
 * {@code executionId}, stamped with {@code scheduleId}; {@code scriptId} disambiguates leaves
 * and result frames. A fire with no scripts, no assigned devices, or no runnable (ACTIVE)
 * scripts dispatches nothing — logged, not fatal.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleFireDispatcher {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptRepository scriptRepository;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    private final ScriptScheduleExecutionNatsPublisher scriptScheduleExecutionNatsPublisher;

    /** Dispatch one fire of {@code schedule}. No-op (logged) when there is nothing to run. */
    public void dispatch(ScriptSchedule schedule, Instant now) {
        List<String> machineIds = resolveMachineIds(schedule.getTenantId(), schedule.getId());
        List<String> scriptIds = schedule.getScriptIds();
        if (scriptIds == null || scriptIds.isEmpty() || machineIds.isEmpty()) {
            log.info("Schedule scheduleId={} has no scripts or no assigned devices — nothing dispatched",
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

    /** Assigned machineIds for the schedule (empty if none / assignment missing). */
    private List<String> resolveMachineIds(String tenantId, String scheduleId) {
        return assignedRepository.findByTenantIdAndScriptScheduleId(tenantId, scheduleId)
                .map(ScriptScheduleMachineAssigned::getMachineIds)
                .filter(Objects::nonNull)
                .orElseGet(List::of);
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

    /** One header row per fire, snapshotting what was attempted. */
    private void saveHeader(Fire fire) {
        scheduleScriptExecutionRepository.save(ScheduleScriptExecution.builder()
                .tenantId(fire.tenantId())
                .executionId(fire.executionId())
                .scheduleId(fire.scheduleId())
                .initiatedBy(fire.initiatedBy())
                .scriptIds(fire.scripts().stream().map(Script::getId).toList())
                .machineIds(fire.machineIds())
                .status(ExecutionStatus.RUNNING)
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
                        .status(ExecutionStatus.RUNNING)
                        .dispatchedAt(fire.now())
                        .statusChangedAt(fire.now())
                        .build()))
                .toList();
        scriptExecutionRepository.saveAll(rows);
    }

    /** Build the shared payload once, fan out ONE message per machine. */
    private void publish(Fire fire) {
        List<ScriptScheduleExecutionItem> items = fire.scripts().stream()
                .map(script -> ScriptScheduleExecutionItem.builder()
                        .scriptId(script.getId())
                        .code(script.getScriptBody())
                        .shell(script.getShell())
                        .privilegeLevel(script.getPrivilegeLevel())
                        .args(ScriptArgsTokenizer.tokenize(script.getDefaultArgs()))
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .envVars(script.getEnvVars())
                        .build())
                .toList();

        fire.machineIds().forEach(machineId -> scriptScheduleExecutionNatsPublisher.publish(machineId,
                ScriptScheduleExecutionMessage.builder()
                        .executionId(fire.executionId())
                        .scheduleId(fire.scheduleId())
                        .machineId(machineId)
                        .initiatedBy(fire.initiatedBy())
                        .scripts(items)
                        .build()));
    }

    /** Everything one fire needs, bundled so the persist/publish steps take a single arg. */
    private record Fire(ScriptSchedule schedule, String executionId, List<Script> scripts,
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
