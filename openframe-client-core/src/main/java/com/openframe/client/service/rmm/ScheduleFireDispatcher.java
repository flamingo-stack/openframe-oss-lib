package com.openframe.client.service.rmm;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.delivery.ScheduleOfflineRule;
import com.openframe.data.nats.delivery.ScriptScheduleDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.util.ScriptScheduleBatch;
import com.openframe.delivery.track.DeliveryTracker;
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

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
    private final DeliveryRouter deliveryRouter;
    private final MachineRepository machineRepository;
    private final DeviceOnlineDispatchRepository dispatchRepository;
    private final ScriptDeliveryRetryStore retryStore;
    private final DeliveryTracker deliveryTracker;

    private static final String SUPERSEDED = "superseded by the schedule's next fire";

    public void dispatch(ScheduleScript schedule, Instant now) {
        List<String> targets = targetResolver.resolveTargetMachineIds(schedule);
        if (targets == null || targets.isEmpty()) {
            dispatch(schedule, targets, now);
            return;
        }

        // a machine whose route holds the batch gets it now and waits there by the schedule's own rule; a machine on
        // the route before the engine is held here, the way it was, until that route is gone
        List<String> unheld = targets.stream().filter(machineId -> !isHeldOnRoute(machineId)).toList();
        Set<String> notOnline = notOnlineAmong(schedule.getTenantId(), unheld);
        if (!notOnline.isEmpty()) {
            List<String> heldHere = List.copyOf(notOnline);
            handleNotOnlineTargets(schedule, heldHere, now);
        }

        List<String> toDispatch = targets.stream().filter(machineId -> !notOnline.contains(machineId)).toList();
        dispatch(schedule, toDispatch, now);
    }

    // one fire for a machine that is offline at its own moment: the batch waits on its route until the deadline
    public void dispatchHeldUntil(ScheduleScript schedule, String machineId, Instant now, Instant reconnectDeadline) {
        long secondsLeft = Math.max(1, Duration.between(now, reconnectDeadline).toSeconds());
        ScheduleOfflineRule rule = ScheduleOfflineRule.waitingFor(secondsLeft);
        dispatch(schedule, List.of(machineId), now, rule);
    }

    private boolean isHeldOnRoute(String machineId) {
        return deliveryRouter.holdsForOfflineMachine(DeliveryType.SCRIPT_SCHEDULE, machineId);
    }

    private Set<String> notOnlineAmong(String tenantId, List<String> machineIds) {
        if (machineIds.isEmpty()) {
            return Set.of();
        }
        Set<String> online = onlineTargets(tenantId, machineIds);
        return machineIds.stream().filter(machineId -> !online.contains(machineId)).collect(Collectors.toSet());
    }

    private static ScheduleOfflineRule ruleOf(ScheduleScript schedule) {
        return ScheduleOfflineRule.of(schedule.getTrigger(), schedule.getOfflineBehavior(), schedule.getReconnectWindowSeconds());
    }

    private static boolean isRetryOnReconnect(ScheduleScript schedule) {
        ScheduleOfflineRule rule = ruleOf(schedule);
        return rule.isWaiting();
    }

    private Set<String> onlineTargets(String tenantId, List<String> targets) {
        return machineRepository.findByTenantIdAndMachineIdIn(tenantId, new HashSet<>(targets)).stream()
                .filter(machine -> machine.getStatus() == DeviceStatus.ONLINE)
                .map(Machine::getMachineId)
                .collect(Collectors.toSet());
    }

    private void handleNotOnlineTargets(ScheduleScript schedule, List<String> notOnline, Instant now) {
        if (isRetryOnReconnect(schedule)) {
            armReconnectRetry(schedule, notOnline, now);
        } else {
            log.info("Skipping {} non-online device(s) for schedule scheduleId={} tenantId={} (offlineBehavior=SKIP)",
                    notOnline.size(), schedule.getId(), schedule.getTenantId());
        }
    }

    private void armReconnectRetry(ScheduleScript schedule, List<String> machineIds, Instant now) {
        Instant expiresAt = now.plusSeconds(schedule.getReconnectWindowSeconds());
        for (String machineId : machineIds) {
            armReconnectRetry(schedule, machineId, now, expiresAt);
        }
        log.info("Armed reconnect-retry for {} offline device(s) scheduleId={} tenantId={} expiresAt={}",
                machineIds.size(), schedule.getId(), schedule.getTenantId(), expiresAt);
    }

    public void armReconnectRetry(ScheduleScript schedule, String machineId, Instant firstSeenAt, Instant expiresAt) {
        DeviceFirstOnlineDispatch row = dispatchRepository
                .findByTenantIdAndMachineIdAndScheduleId(schedule.getTenantId(), machineId, schedule.getId())
                .orElseGet(() -> DeviceFirstOnlineDispatch.builder()
                        .tenantId(schedule.getTenantId())
                        .machineId(machineId)
                        .scheduleId(schedule.getId())
                        .build());
        row.setStatus(DeviceOnlineDispatchStatus.NEW);
        row.setFirstSeenAt(firstSeenAt);
        row.setExpiresAt(expiresAt);
        try {
            dispatchRepository.save(row);
        } catch (DuplicateKeyException raced) {
            log.debug("reconnect-retry sentinel armed concurrently: machineId={} scheduleId={}",
                    machineId, schedule.getId());
        }
    }

    /**
     * Dispatch one fire of {@code schedule} to a specific set of machines — used by the
     * DEVICE_ONLINE trigger, which fires only on the single machine that just came online.
     * The caller is responsible for the machines being genuinely assigned. No-op (logged) when
     * there is nothing to run.
     */
    public void dispatch(ScheduleScript schedule, List<String> machineIds, Instant now) {
        ScheduleOfflineRule rule = ruleOf(schedule);
        dispatch(schedule, machineIds, now, rule);
    }

    // rule: what the batch does on its route for a machine that is not online, skip or wait for the reconnect
    private void dispatch(ScheduleScript schedule, List<String> machineIds, Instant now, ScheduleOfflineRule rule) {
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

        if (rule.isWaiting()) {
            withdrawEarlierFires(schedule, machineIds);
        }

        // One executionId for the whole fire, shared across every script and machine.
        Fire fire = new Fire(schedule, UUID.randomUUID().toString(), scripts, machineIds, now, rule);
        saveHeader(fire);
        saveLeafRows(fire);
        publish(fire);

        log.info("Dispatched schedule fire scheduleId={} executionId={} scripts={} machines={}",
                fire.scheduleId(), fire.executionId(), scripts.size(), machineIds.size());
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

    // the fires a machine missed while offline were one catch-up on the reconnect sentinel (one per schedule and
    // machine); on the engine each fire is a batch of its own, so a machine still offline and waiting for an earlier
    // fire of this schedule gets this one instead of both
    private void withdrawEarlierFires(ScheduleScript schedule, List<String> machineIds) {
        String tenantId = schedule.getTenantId();
        List<ScriptExecution> waiting = scriptExecutionRepository.findByTenantIdAndScheduleIdAndStatus(
                tenantId, schedule.getId(), ExecutionStatus.QUEUED);
        Set<String> targets = new HashSet<>(machineIds);
        Set<String> heldMachines = waiting.stream()
                .map(ScriptExecution::getMachineId)
                .filter(targets::contains)
                .filter(this::isHeldOnRoute)
                .collect(Collectors.toSet());
        if (heldMachines.isEmpty()) {
            return;
        }
        Set<String> online = onlineTargets(tenantId, List.copyOf(heldMachines));
        Set<DeliveryKey> superseded = waiting.stream()
                .filter(leaf -> heldMachines.contains(leaf.getMachineId()) && !online.contains(leaf.getMachineId()))
                .map(leaf -> new DeliveryKey(leaf.getExecutionId(), leaf.getMachineId()))
                .collect(Collectors.toSet());
        superseded.forEach(key -> deliveryTracker.cancel(DeliveryType.SCRIPT_SCHEDULE, key.executionId(), key.machineId(), SUPERSEDED));
        if (!superseded.isEmpty()) {
            log.info("Earlier fires withdrawn for machines still offline: scheduleId={} deliveries={}", schedule.getId(), superseded.size());
        }
    }

    private record DeliveryKey(String executionId, String machineId) {
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
                        .status(ExecutionStatus.QUEUED)
                        .dispatchedAt(fire.now())
                        .statusChangedAt(fire.now())
                        .build()))
                .toList();
        scriptExecutionRepository.saveAll(rows);
    }

    /** Build the shared payload once, fan out ONE message per machine. */
    private void publish(Fire fire) {
        ScheduleScript schedule = fire.schedule();
        List<ScheduledScriptCustomParams> customParams = schedule.getScriptCustomParams();
        List<ScriptScheduleExecutionItem> items = ScriptScheduleBatch.items(fire.scripts(), customParams);
        fire.machineIds().forEach(machineId -> {
            // the same batch for every machine of the fire: the machine is the seed's, the engine keeps one body per fire
            ScriptScheduleExecutionMessage message = ScriptScheduleExecutionMessage.builder()
                    .executionId(fire.executionId())
                    .scheduleId(fire.scheduleId())
                    .initiatedBy(fire.initiatedBy())
                    .scripts(items)
                    .build();
            // the retry state serves the path without the engine; stored before the dispatch stamps the delivery block
            retryStore.store(fire.executionId(), machineId, DeliveryChannel.SCHEDULE, message);
            ScriptScheduleDeliverySeed seed = ScriptScheduleDeliverySeed.withRule(machineId, message, fire.rule());
            deliveryRouter.dispatch(seed);
        });
    }

    /** Everything one fire needs, bundled so the persist/publish steps take a single arg. */
    private record Fire(ScheduleScript schedule, String executionId, List<Script> scripts,
                        List<String> machineIds, Instant now, ScheduleOfflineRule rule) {
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
