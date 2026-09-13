package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceLocalTimeDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.publisher.MachineTimezoneRequestNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScheduleDeviceLocalDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import com.openframe.data.service.rmm.SoftwareScheduleTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Service
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
public class SoftwareDeviceLocalScheduleService {

    private final SoftwareScheduleRepository scheduleRepository;
    private final SoftwareScheduleTargetResolver targetResolver;
    private final MachineRepository machineRepository;
    private final ScheduleDeviceLocalDispatchRepository dispatchRepository;
    private final SoftwareScheduleFireDispatcher fireDispatcher;
    private final MachineTimezoneRequestNatsPublisher timezoneRequestPublisher;

    @Value("${openframe.rmm.schedule.device-local.catchup-seconds}")
    private long catchupSeconds;

    public void runDueDeviceLocalSchedules(Instant now) {
        List<SoftwareSchedule> schedules = scheduleRepository.findByStatusAndTriggerAndTimeReference(
                ScriptStatus.ACTIVE, ScheduleScriptTrigger.DATE_TIME, ScheduleTimeReference.DEVICE_LOCAL);
        if (schedules.isEmpty()) {
            log.debug("No active device-local software schedules");
            return;
        }
        log.debug("Evaluating {} device-local software schedule(s)", schedules.size());
        schedules.forEach(schedule -> evaluate(schedule, now));
    }

    private void evaluate(SoftwareSchedule schedule, Instant now) {
        try {
            evaluateSchedule(schedule, now);
        } catch (Exception e) {
            log.error("Device-local software schedule evaluation failed scheduleId={} tenantId={}",
                    schedule.getId(), schedule.getTenantId(), e);
        }
    }

    private void evaluateSchedule(SoftwareSchedule schedule, Instant now) {
        Instant startAt = schedule.getStartAt();
        if (startAt == null) {
            log.warn("DEVICE_LOCAL software schedule scheduleId={} has no startAt — skipping", schedule.getId());
            return;
        }
        List<String> targets = resolveTargets(schedule);
        if (targets.isEmpty()) {
            return;
        }

        Map<String, ScheduleLocalMachineTimeDispatch> sentinelByMachine = dispatchRepository
                .findByScheduleIdAndMachineIdIn(schedule.getId(), targets).stream()
                .collect(Collectors.toMap(ScheduleLocalMachineTimeDispatch::getMachineId, Function.identity(), (a, b) -> a));
        Map<String, Machine> machinesById = machineRepository
                .findByTenantIdAndMachineIdIn(schedule.getTenantId(), new HashSet<>(targets)).stream()
                .collect(Collectors.toMap(Machine::getMachineId, Function.identity(), (a, b) -> a));

        LocalDateTime startWallClock = LocalDateTime.ofInstant(startAt, ZoneOffset.UTC);
        Long repeat = schedule.getRepeat();
        long window = catchupSeconds;

        for (String machineId : targets) {
            Machine machine = machinesById.get(machineId);
            if (machine == null) {
                continue;
            }
            ScheduleLocalMachineTimeDispatch sentinel = sentinelByMachine.get(machineId);
            if (machine.getStatus() == DeviceStatus.ONLINE) {
                evaluateOnline(schedule, machine, startWallClock, repeat, now, sentinel, window);
            } else {
                evaluateOffline(schedule, machine, startWallClock, repeat, now, sentinel, window);
            }
        }
    }

    private void evaluateOnline(SoftwareSchedule schedule, Machine machine, LocalDateTime startWallClock, Long repeat,
                                Instant now, ScheduleLocalMachineTimeDispatch sentinel, long window) {
        String machineId = machine.getMachineId();
        if (repeat == null && DeviceLocalOccurrence.isHandled(sentinel)) {
            return;
        }
        timezoneRequestPublisher.request(machineId, schedule.getId());

        String zoneId = machine.getTimezone();
        if (isBlank(zoneId)) {
            log.info("DEVICE_LOCAL software scheduleId={} machineId={} has no known timezone yet — requested, deferring",
                    schedule.getId(), machineId);
            return;
        }
        ZoneId zone = parseZone(schedule, machineId, zoneId);
        if (zone == null) {
            return;
        }
        LocalDateTime occurrence = DeviceLocalOccurrence.currentDueOccurrence(startWallClock, repeat, zone, now);
        if (occurrence == null) {
            return;
        }
        Instant occurrenceAt = occurrence.toInstant(ZoneOffset.UTC);
        if (DeviceLocalOccurrence.isAlreadyHandled(sentinel, occurrenceAt)) {
            return;
        }
        Instant fireAt = occurrence.atZone(zone).toInstant();
        if (now.isAfter(fireAt.plusSeconds(window))) {
            record(schedule, machineId, occurrenceAt, now, ScheduleDeviceLocalTimeDispatchStatus.MISSED, sentinel);
            log.warn("DEVICE_LOCAL software scheduleId={} machineId={} occurrence fireAt={} past fire window ({}s) — MISSED",
                    schedule.getId(), machineId, fireAt, window);
            return;
        }
        if (!record(schedule, machineId, occurrenceAt, now, ScheduleDeviceLocalTimeDispatchStatus.FIRED, sentinel)) {
            return;
        }
        fireDispatcher.dispatch(schedule, List.of(machineId), now);
        log.info("Dispatched DEVICE_LOCAL software scheduleId={} machineId={} zone={} fireAt={}",
                schedule.getId(), machineId, zone, fireAt);
    }

    private void evaluateOffline(SoftwareSchedule schedule, Machine machine, LocalDateTime startWallClock, Long repeat,
                                 Instant now, ScheduleLocalMachineTimeDispatch sentinel, long window) {
        if (repeat == null && DeviceLocalOccurrence.isHandled(sentinel)) {
            return;
        }
        String machineId = machine.getMachineId();
        String zoneId = machine.getTimezone();

        // Offline: SKIP semantics — mark MISSED once the occurrence is definitely past for the device.
        Instant occurrenceAt;
        Instant latestFireAt;
        if (isBlank(zoneId)) {
            if (repeat != null) {
                return; // recurring + unknown zone: wait until the device reports a zone
            }
            occurrenceAt = startWallClock.toInstant(ZoneOffset.UTC);
            latestFireAt = DeviceLocalOccurrence.latestPossibleFireAt(startWallClock, null);
        } else {
            ZoneId zone = parseZone(schedule, machineId, zoneId);
            if (zone == null) {
                return;
            }
            LocalDateTime occurrence = DeviceLocalOccurrence.currentDueOccurrence(startWallClock, repeat, zone, now);
            if (occurrence == null) {
                return;
            }
            occurrenceAt = occurrence.toInstant(ZoneOffset.UTC);
            latestFireAt = occurrence.atZone(zone).toInstant();
        }
        if (DeviceLocalOccurrence.isAlreadyHandled(sentinel, occurrenceAt)) {
            return;
        }
        if (now.isAfter(latestFireAt.plusSeconds(window))) {
            record(schedule, machineId, occurrenceAt, now, ScheduleDeviceLocalTimeDispatchStatus.MISSED, sentinel);
            log.warn("DEVICE_LOCAL software scheduleId={} machineId={} offline past fire window — MISSED",
                    schedule.getId(), machineId);
        }
    }

    private List<String> resolveTargets(SoftwareSchedule schedule) {
        return targetResolver.resolveMachineIds(schedule.getTenantId(), schedule.getId());
    }

    private ZoneId parseZone(SoftwareSchedule schedule, String machineId, String zoneId) {
        ZoneId zone = DeviceLocalOccurrence.parseZone(zoneId);
        if (zone == null) {
            log.warn("DEVICE_LOCAL software scheduleId={} machineId={} has invalid stored timezone '{}' — skipping",
                    schedule.getId(), machineId, zoneId);
        }
        return zone;
    }

    private boolean record(SoftwareSchedule schedule, String machineId, Instant occurrenceAt, Instant now,
                           ScheduleDeviceLocalTimeDispatchStatus status, ScheduleLocalMachineTimeDispatch existing) {
        ScheduleLocalMachineTimeDispatch row = existing != null ? existing
                : ScheduleLocalMachineTimeDispatch.builder()
                        .tenantId(schedule.getTenantId())
                        .scheduleId(schedule.getId())
                        .machineId(machineId)
                        .build();
        row.setLastOccurrenceAt(occurrenceAt);
        row.setFiredAt(now);
        row.setStatus(status);
        try {
            dispatchRepository.save(row);
            return true;
        } catch (DuplicateKeyException raced) {
            log.debug("DEVICE_LOCAL software sentinel written concurrently scheduleId={} machineId={} — skipping",
                    schedule.getId(), machineId);
            return false;
        }
    }
}
