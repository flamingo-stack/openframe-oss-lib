package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceLocalTimeDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.publisher.MachineTimezoneRequestNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceLocalScheduleService {

    private static final ZoneOffset LATEST_ZONE = ZoneOffset.ofHours(-12);

    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleDeviceTargetResolver targetResolver;
    private final MachineRepository machineRepository;
    private final ScheduleDeviceLocalDispatchRepository dispatchRepository;
    private final ScheduleFireDispatcher fireDispatcher;
    private final MachineTimezoneRequestNatsPublisher timezoneRequestPublisher;

    @Value("${openframe.rmm.schedule.device-local.catchup-seconds}")
    private long catchupSeconds;

    public void runDueDeviceLocalSchedules(Instant now) {
        List<ScheduleScript> schedules = scheduleRepository.findByStatusAndTriggerAndTimeReference(
                ScriptStatus.ACTIVE, ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL);
        if (schedules.isEmpty()) {
            log.debug("No active device-local schedules");
            return;
        }

        log.debug("Evaluating {} device-local schedule(s)", schedules.size());
        for (ScheduleScript schedule : schedules) {
            try {
                evaluate(schedule, now);
            } catch (Exception e) {
                log.error("Device-local schedule evaluation failed scheduleId={} tenantId={}",
                        schedule.getId(), schedule.getTenantId(), e);
            }
        }
    }

    private void evaluate(ScheduleScript schedule, Instant now) {
        Instant wallClockInstant = schedule.getStartAt();
        if (wallClockInstant == null) {
            log.warn("DEVICE_LOCAL schedule scheduleId={} has no startAt (wall-clock) — skipping", schedule.getId());
            return;
        }

        List<String> targets = targetResolver.resolveTargetMachineIds(schedule);
        if (targets == null || targets.isEmpty()) {
            return;
        }

        Set<String> alreadyResolved = dispatchRepository
                .findByScheduleIdAndMachineIdIn(schedule.getId(), targets).stream()
                .map(ScheduleLocalMachineTimeDispatch::getMachineId)
                .collect(Collectors.toSet());
        List<String> pending = targets.stream().filter(id -> !alreadyResolved.contains(id)).toList();
        if (pending.isEmpty()) {
            return;
        }

        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(schedule.getTenantId(), new HashSet<>(pending)).stream()
                .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));

        // The naive wall-clock the user picked, read back with the UTC offset the API encoded it with.
        LocalDateTime wallClock = LocalDateTime.ofInstant(wallClockInstant, ZoneOffset.UTC);

        for (String machineId : pending) {
            Machine machine = machinesById.get(machineId);
            if (machine == null) {
                continue;
            }
            if (machine.getStatus() == DeviceStatus.ONLINE) {
                evaluateOnline(schedule, machine, wallClock, now);
            } else {
                houseKeepNotOnline(schedule, machine, wallClock, now);
            }
        }
    }

    private void evaluateOnline(ScheduleScript schedule, Machine machine, LocalDateTime wallClock, Instant now) {
        String machineId = machine.getMachineId();

        // Refresh the device's timezone for this and future sweeps; the reply lands asynchronously.
        timezoneRequestPublisher.request(machineId, schedule.getId());

        String zoneId = machine.getTimezone();
        if (isBlank(zoneId)) {
            log.info("DEVICE_LOCAL scheduleId={} machineId={} has no known timezone yet — requested, deferring",
                    schedule.getId(), machineId);
            return;
        }

        ZoneId zone;
        try {
            zone = ZoneId.of(zoneId);
        } catch (DateTimeException e) {
            log.warn("DEVICE_LOCAL scheduleId={} machineId={} has invalid stored timezone '{}' — skipping",
                    schedule.getId(), machineId, zoneId);
            return;
        }

        Instant fireAt = wallClock.atZone(zone).toInstant();
        if (now.isBefore(fireAt)) {
            return; // the device's local run time has not arrived yet
        }
        if (now.isAfter(fireAt.plusSeconds(catchupSeconds))) {
            markTerminal(schedule, machineId, now, ScheduleDeviceLocalTimeDispatchStatus.MISSED);
            log.warn("DEVICE_LOCAL scheduleId={} machineId={} missed its local run (fireAt={}, now={}) "
                    + "beyond the catch-up window — marked MISSED", schedule.getId(), machineId, fireAt, now);
            return;
        }

        // Claim the fire before dispatching so a concurrent replica cannot run it twice.
        if (!markTerminal(schedule, machineId, now, ScheduleDeviceLocalTimeDispatchStatus.FIRED)) {
            return;
        }
        fireDispatcher.dispatch(schedule, List.of(machineId), now);
        log.info("Dispatched DEVICE_LOCAL scheduleId={} machineId={} zone={} fireAt={}",
                schedule.getId(), machineId, zone, fireAt);
    }

    private void houseKeepNotOnline(ScheduleScript schedule, Machine machine, LocalDateTime wallClock, Instant now) {
        Instant latestPossibleFireAt = latestPossibleFireAt(wallClock, machine.getTimezone());
        if (now.isAfter(latestPossibleFireAt.plusSeconds(catchupSeconds))) {
            markTerminal(schedule, machine.getMachineId(), now, ScheduleDeviceLocalTimeDispatchStatus.MISSED);
            log.warn("DEVICE_LOCAL scheduleId={} machineId={} stayed non-online past its run window "
                    + "— marked MISSED", schedule.getId(), machine.getMachineId());
        }
    }

    private static Instant latestPossibleFireAt(LocalDateTime wallClock, String storedTimezone) {
        if (!isBlank(storedTimezone)) {
            try {
                return wallClock.atZone(ZoneId.of(storedTimezone)).toInstant();
            } catch (DateTimeException ignored) {
                // fall through to the global upper bound
            }
        }
        return wallClock.atOffset(LATEST_ZONE).toInstant();
    }

    private boolean markTerminal(ScheduleScript schedule, String machineId, Instant now,
                                 ScheduleDeviceLocalTimeDispatchStatus status) {
        try {
            dispatchRepository.insert(ScheduleLocalMachineTimeDispatch.builder()
                    .tenantId(schedule.getTenantId())
                    .scheduleId(schedule.getId())
                    .machineId(machineId)
                    .firedAt(now)
                    .status(status)
                    .build());
            return true;
        } catch (DuplicateKeyException raced) {
            log.debug("DEVICE_LOCAL sentinel already present for scheduleId={} machineId={} — skipping",
                    schedule.getId(), machineId);
            return false;
        }
    }
}
