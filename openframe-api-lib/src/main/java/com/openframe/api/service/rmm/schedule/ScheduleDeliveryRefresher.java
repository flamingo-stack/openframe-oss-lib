package com.openframe.api.service.rmm.schedule;

import com.openframe.data.document.delivery.DeliveryOfflineBehavior;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.delivery.ScheduleOfflineRule;
import com.openframe.data.nats.rmm.util.ScriptScheduleBatch;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.dispatch.DeliveryRefresher;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

import static java.util.stream.Collectors.groupingBy;
import static java.util.stream.Collectors.toMap;
import static java.util.stream.Collectors.toSet;

// a batch waiting on the engine for a machine carries what the user sees now, not what was there when the schedule
// fired: an edit of a script or of the schedule replaces the waiting bodies and the leaves follow (a script added to
// the schedule gets a leaf, one removed closes), a schedule or a device that is gone withdraws them. A leaf still
// QUEUED is the sign the machine has not received the batch
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleDeliveryRefresher {

    private static final String NOTHING_LEFT_TO_RUN = "no runnable script left in the batch";
    private static final String REMOVED_FROM_SCHEDULE = "Script was removed from the schedule before the agent received it";

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final ScriptRepository scriptRepository;
    private final DeliveryRefresher deliveryRefresher;
    private final DeliveryTracker deliveryTracker;
    private final TenantIdProvider tenantIdProvider;

    public void refreshForScript(String scriptId) {
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptExecution> queued = scriptExecutionRepository.findByTenantIdAndScriptIdAndStatus(tenantId, scriptId, ExecutionStatus.QUEUED);
        refresh(tenantId, queued);
    }

    public void refreshForSchedule(String scheduleId) {
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptExecution> queued = queuedLeavesOf(tenantId, scheduleId);
        refresh(tenantId, queued);
    }

    // the script is gone: the batches still waiting carry what is left of the fire, a batch with nothing left is
    // withdrawn, and the script's own leaves close here with the reason, the agent will never run them
    public void retireScript(String scriptId, String reason) {
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptExecution> queued = scriptExecutionRepository.findByTenantIdAndScriptIdAndStatus(tenantId, scriptId, ExecutionStatus.QUEUED);
        refresh(tenantId, queued);
        Instant now = Instant.now();
        queued.forEach(leaf -> markFailed(leaf, now, reason));
        if (!queued.isEmpty()) {
            scriptExecutionRepository.saveAll(queued);
            log.info("Leaves of a retired script closed: scriptId={} leaves={} reason={}", scriptId, queued.size(), reason);
        }
    }

    public void cancelForSchedule(String scheduleId, String reason) {
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptExecution> queued = queuedLeavesOf(tenantId, scheduleId);
        cancel(queued, reason);
    }

    public void cancelForMachines(String scheduleId, Collection<String> machineIds, String reason) {
        String tenantId = tenantIdProvider.getTenantId();
        List<ScriptExecution> queued = queuedLeavesOf(tenantId, scheduleId).stream()
                .filter(leaf -> machineIds.contains(leaf.getMachineId()))
                .toList();
        cancel(queued, reason);
    }

    private List<ScriptExecution> queuedLeavesOf(String tenantId, String scheduleId) {
        return scriptExecutionRepository.findByTenantIdAndScheduleIdAndStatus(tenantId, scheduleId, ExecutionStatus.QUEUED);
    }

    private void refresh(String tenantId, List<ScriptExecution> queuedLeaves) {
        Map<String, List<ScriptExecution>> byExecution = queuedLeaves.stream().collect(groupingBy(ScriptExecution::getExecutionId));
        byExecution.forEach((executionId, leaves) -> refreshExecution(tenantId, executionId, leaves));
    }

    private void refreshExecution(String tenantId, String executionId, List<ScriptExecution> queuedLeaves) {
        ScriptExecution first = queuedLeaves.getFirst();
        Optional<ScheduleScript> schedule = activeSchedule(tenantId, first.getScheduleId());
        if (schedule.isEmpty()) {
            log.debug("Waiting batches kept, their schedule is gone: executionId={}", executionId);
            return;
        }
        ScheduleScript current = schedule.get();
        List<Script> scripts = runnableScriptsOf(tenantId, current);
        if (scripts.isEmpty()) {
            cancel(queuedLeaves, NOTHING_LEFT_TO_RUN);
            return;
        }
        List<ScheduledScriptCustomParams> customParams = current.getScriptCustomParams();
        List<ScriptScheduleExecutionItem> items = ScriptScheduleBatch.items(scripts, customParams);
        ScriptScheduleExecutionMessage message = ScriptScheduleExecutionMessage.builder()
                .executionId(executionId)
                .scheduleId(first.getScheduleId())
                .initiatedBy(first.getInitiatedBy())
                .scripts(items)
                .build();
        Set<String> waitingMachines = queuedLeaves.stream().map(ScriptExecution::getMachineId).collect(toSet());
        ScheduleOfflineRule rule = ScheduleOfflineRule.of(current.getTrigger(), current.getOfflineBehavior(), current.getReconnectWindowSeconds());
        DeliveryOfflineBehavior offlineBehavior = rule.behavior();
        Long reconnectWindowSeconds = rule.reconnectWindowSeconds();
        Set<String> replaced = waitingMachines.stream()
                .filter(machineId -> deliveryRefresher.refresh(DeliveryType.SCRIPT_SCHEDULE, executionId, machineId, message,
                        offlineBehavior, reconnectWindowSeconds))
                .collect(toSet());
        List<ScriptExecution> leavesOfTheFire = scriptExecutionRepository.findByTenantIdAndExecutionId(tenantId, executionId);
        alignLeaves(leavesOfTheFire, replaced, scripts);
        log.info("Waiting batches refreshed: executionId={} machines={} replaced={}", executionId, waitingMachines.size(), replaced.size());
    }

    // the leaves of a machine whose waiting body was replaced are the batch it will get: a script that left the batch
    // closes, a script that joined it gets a leaf (or its closed leaf back, the fire holds one leaf per script and
    // machine), the rest keep the script's privilege and timeout as they are now (the result watchdog reads the leaf).
    // A machine whose body stayed (the agent took it, or it is on the route before the engine) keeps its leaves: they
    // are the batch the agent runs
    private void alignLeaves(List<ScriptExecution> leavesOfTheFire, Set<String> replacedMachines, List<Script> scripts) {
        Instant now = Instant.now();
        Map<String, Script> byId = scripts.stream().collect(toMap(Script::getId, Function.identity(), (first, second) -> first));
        List<ScriptExecution> changed = new ArrayList<>();
        for (String machineId : replacedMachines) {
            Map<String, ScriptExecution> byScript = leavesOfTheFire.stream()
                    .filter(leaf -> machineId.equals(leaf.getMachineId()))
                    .collect(toMap(ScriptExecution::getScriptId, Function.identity(), (first, second) -> first));
            ScriptExecution own = byScript.values().iterator().next();
            byScript.values().stream()
                    .filter(leaf -> isQueued(leaf) && !byId.containsKey(leaf.getScriptId()))
                    .forEach(leaf -> {
                        markFailed(leaf, now, REMOVED_FROM_SCHEDULE);
                        changed.add(leaf);
                    });
            for (Script script : scripts) {
                ScriptExecution leaf = byScript.get(script.getId());
                if (leaf == null) {
                    changed.add(newLeaf(own, machineId, script, now));
                } else if (!isQueued(leaf)) {
                    reopen(leaf, script, now);
                    changed.add(leaf);
                } else if (follow(leaf, script)) {
                    changed.add(leaf);
                }
            }
        }
        if (!changed.isEmpty()) {
            scriptExecutionRepository.saveAll(changed);
        }
    }

    // a sibling of the machine's own leaves: same fire, same machine, the fire's dispatch time
    private static ScriptExecution newLeaf(ScriptExecution own, String machineId, Script script, Instant now) {
        return ScriptExecution.builder()
                .tenantId(own.getTenantId())
                .executionId(own.getExecutionId())
                .scheduleId(own.getScheduleId())
                .machineId(machineId)
                .scriptId(script.getId())
                .privilegeLevel(script.getPrivilegeLevel())
                .timeoutSeconds(script.getDefaultTimeoutSeconds())
                .initiatedBy(own.getInitiatedBy())
                .source(ExecutionSource.SCHEDULED)
                .status(ExecutionStatus.QUEUED)
                .dispatchedAt(own.getDispatchedAt())
                .statusChangedAt(now)
                .build();
    }

    private static void reopen(ScriptExecution leaf, Script script, Instant now) {
        leaf.setStatus(ExecutionStatus.QUEUED);
        leaf.setStatusChangedAt(now);
        leaf.setFinishedAt(null);
        leaf.setTimedOut(null);
        leaf.setError(null);
        follow(leaf, script);
    }

    private static boolean isQueued(ScriptExecution leaf) {
        return leaf.getStatus() == ExecutionStatus.QUEUED;
    }

    private static boolean follow(ScriptExecution leaf, Script script) {
        boolean changed = !Objects.equals(leaf.getPrivilegeLevel(), script.getPrivilegeLevel())
                || !Objects.equals(leaf.getTimeoutSeconds(), script.getDefaultTimeoutSeconds());
        leaf.setPrivilegeLevel(script.getPrivilegeLevel());
        leaf.setTimeoutSeconds(script.getDefaultTimeoutSeconds());
        return changed;
    }


    private Optional<ScheduleScript> activeSchedule(String tenantId, String scheduleId) {
        if (scheduleId == null) {
            return Optional.empty();
        }
        return scheduleRepository.findByTenantIdAndId(tenantId, scheduleId)
                .filter(ScheduleDeliveryRefresher::isActive);
    }

    // the schedule's scripts as they are now, in its order, active only: what the machine gets is the schedule the
    // user sees, not the one that fired
    private List<Script> runnableScriptsOf(String tenantId, ScheduleScript schedule) {
        List<String> ids = schedule.getScriptIds() == null ? List.of() : schedule.getScriptIds().stream().distinct().toList();
        Map<String, Script> byId = scriptRepository.findByTenantIdAndIdIn(tenantId, new HashSet<>(ids)).stream()
                .filter(ScheduleDeliveryRefresher::isActive)
                .collect(toMap(Script::getId, Function.identity(), (first, second) -> first));
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    private void cancel(List<ScriptExecution> queuedLeaves, String reason) {
        Set<DeliveryKey> waiting = queuedLeaves.stream()
                .map(leaf -> new DeliveryKey(leaf.getExecutionId(), leaf.getMachineId()))
                .collect(toSet());
        waiting.forEach(key -> deliveryTracker.cancel(DeliveryType.SCRIPT_SCHEDULE, key.executionId(), key.machineId(), reason));
        if (!waiting.isEmpty()) {
            log.info("Waiting batches withdrawn: deliveries={} reason={}", waiting.size(), reason);
        }
    }

    private static void markFailed(ScriptExecution leaf, Instant now, String reason) {
        leaf.setStatus(ExecutionStatus.FAILED);
        leaf.setStatusChangedAt(now);
        leaf.setFinishedAt(now);
        leaf.setError(reason);
    }

    private static boolean isActive(ScheduleScript schedule) {
        return schedule.getStatus() == ScriptStatus.ACTIVE;
    }

    private static boolean isActive(Script script) {
        return script.getStatus() == ScriptStatus.ACTIVE;
    }

    private record DeliveryKey(String executionId, String machineId) {
    }
}
