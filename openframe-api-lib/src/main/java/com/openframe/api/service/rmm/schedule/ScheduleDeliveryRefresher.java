package com.openframe.api.service.rmm.schedule;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
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

import java.util.Collection;
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
// fired: an edit of a script or of the schedule's parameters replaces the waiting bodies, a schedule or a device that
// is gone withdraws them. A leaf still QUEUED is the sign the machine has not received the batch
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleDeliveryRefresher {

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
        List<Script> scripts = runnableScriptsOf(tenantId, executionId, schedule.get());
        if (scripts.isEmpty()) {
            log.debug("Waiting batches kept, no runnable script left: executionId={}", executionId);
            return;
        }
        List<ScriptScheduleExecutionItem> items = ScriptScheduleBatch.items(scripts, schedule.get().getScriptCustomParams());
        ScriptScheduleExecutionMessage message = ScriptScheduleExecutionMessage.builder()
                .executionId(executionId)
                .scheduleId(first.getScheduleId())
                .initiatedBy(first.getInitiatedBy())
                .scripts(items)
                .build();
        Set<String> waitingMachines = queuedLeaves.stream().map(ScriptExecution::getMachineId).collect(toSet());
        long replaced = waitingMachines.stream()
                .filter(machineId -> deliveryRefresher.refresh(DeliveryType.SCRIPT_SCHEDULE, executionId, machineId, message))
                .count();
        log.info("Waiting batches refreshed: executionId={} machines={} replaced={}", executionId, waitingMachines.size(), replaced);
    }

    private Optional<ScheduleScript> activeSchedule(String tenantId, String scheduleId) {
        if (scheduleId == null) {
            return Optional.empty();
        }
        return scheduleRepository.findByTenantIdAndId(tenantId, scheduleId)
                .filter(ScheduleDeliveryRefresher::isActive);
    }

    // the fire's own scripts, in the schedule's order, as they are now: a script the user removed from the schedule
    // since stays in a batch that was built with it, the leaves of the fire are what the user sees of it
    private List<Script> runnableScriptsOf(String tenantId, String executionId, ScheduleScript schedule) {
        Set<String> fired = scriptExecutionRepository.findByTenantIdAndExecutionId(tenantId, executionId).stream()
                .map(ScriptExecution::getScriptId)
                .collect(toSet());
        Map<String, Script> byId = scriptRepository.findByTenantIdAndIdIn(tenantId, fired).stream()
                .filter(ScheduleDeliveryRefresher::isActive)
                .collect(toMap(Script::getId, Function.identity(), (first, second) -> first));
        List<String> orderedIds = schedule.getScriptIds() == null ? List.of() : schedule.getScriptIds();
        List<Script> ordered = orderedIds.stream().distinct().map(byId::get).filter(Objects::nonNull).toList();
        if (!ordered.isEmpty()) {
            return ordered;
        }
        return fired.stream().map(byId::get).filter(Objects::nonNull).toList();
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

    private static boolean isActive(ScheduleScript schedule) {
        return schedule.getStatus() == ScriptStatus.ACTIVE;
    }

    private static boolean isActive(Script script) {
        return script.getStatus() == ScriptStatus.ACTIVE;
    }

    private record DeliveryKey(String executionId, String machineId) {
    }
}
