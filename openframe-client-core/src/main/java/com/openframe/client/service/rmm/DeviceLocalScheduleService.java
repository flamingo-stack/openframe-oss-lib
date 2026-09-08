package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceLocalTimeDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleLocalMachineTimeDispatch;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
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
import java.time.Duration;
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
        schedules.forEach(schedule -> evaluate(schedule, now));
    }

    private void evaluate(ScheduleScript schedule, Instant now) {
        try {
            evaluateSchedule(schedule, now);
        } catch (Exception e) {
            log.error("Device-local schedule evaluation failed scheduleId={} tenantId={}", schedule.getId(), schedule.getTenantId(), e);
        }
    }

    private void evaluateSchedule(ScheduleScript schedule, Instant now) {
        Instant startAt = schedule.getStartAt();
        if (startAt == null) {
            log.warn("DEVICE_LOCAL schedule scheduleId={} has no startAt (wall-clock) — skipping", schedule.getId());
            return;
        }

        List<String> targets = targetResolver.resolveTargetMachineIds(schedule);
        if (targets == null || targets.isEmpty()) {
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
        long window = fireWindowSeconds(schedule);

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

    private void evaluateOnline(ScheduleScript schedule, Machine machine, LocalDateTime startWallClock, Long repeat,
                                Instant now, ScheduleLocalMachineTimeDispatch sentinel, long window) {
        String machineId = machine.getMachineId();

        if (repeat == null && isHandled(sentinel)) {
            return;
        }

        timezoneRequestPublisher.request(machineId, schedule.getId());

        String zoneId = machine.getTimezone();
        if (isBlank(zoneId)) {
            log.info("DEVICE_LOCAL scheduleId={} machineId={} has no known timezone yet — requested, deferring",
                    schedule.getId(), machineId);
            return;
        }

        ZoneId zone = parseZone(schedule, machineId, zoneId);
        if (zone == null) {
            return;
        }

        LocalDateTime occurrence = currentDueOccurrence(startWallClock, repeat, zone, now);
        if (occurrence == null) {
            return;
        }
        Instant occurrenceAt = occurrence.toInstant(ZoneOffset.UTC);
        if (isAlreadyHandled(sentinel, occurrenceAt)) {
            return;
        }

        Instant fireAt = occurrence.atZone(zone).toInstant();
        if (now.isAfter(fireAt.plusSeconds(window))) {
            record(schedule, machineId, occurrenceAt, now, ScheduleDeviceLocalTimeDispatchStatus.MISSED, sentinel);
            log.warn("DEVICE_LOCAL scheduleId={} machineId={} occurrence fireAt={} past the fire window ({}s) at "
                    + "now={} — marked MISSED, advancing", schedule.getId(), machineId, fireAt, window, now);
            return;
        }

        if (!record(schedule, machineId, occurrenceAt, now, ScheduleDeviceLocalTimeDispatchStatus.FIRED, sentinel)) {
            return;
        }
        fireDispatcher.dispatch(schedule, List.of(machineId), now);
        log.info("Dispatched DEVICE_LOCAL scheduleId={} machineId={} zone={} fireAt={}",
                schedule.getId(), machineId, zone, fireAt);
    }

    private void evaluateOffline(ScheduleScript schedule, Machine machine, LocalDateTime startWallClock, Long repeat,
                                 Instant now, ScheduleLocalMachineTimeDispatch sentinel, long window) {
        if (repeat == null && isHandled(sentinel)) {
            return;
        }
        String machineId = machine.getMachineId();
        String zoneId = machine.getTimezone();

        if (isBlank(zoneId)) {
            if (repeat == null) {
                Instant occurrenceAt = startWallClock.toInstant(ZoneOffset.UTC);
                if (!isAlreadyHandled(sentinel, occurrenceAt)
                        && now.isAfter(latestPossibleFireAt(startWallClock, null).plusSeconds(window))) {
                    record(schedule, machineId, occurrenceAt, now, ScheduleDeviceLocalTimeDispatchStatus.MISSED, sentinel);
                    log.warn("DEVICE_LOCAL scheduleId={} machineId={} offline with no known timezone past its run "
                            + "window — marked MISSED", schedule.getId(), machineId);
                }
            }
            return;
        }

        ZoneId zone = parseZone(schedule, machineId, zoneId);
        if (zone == null) {
            return;
        }
        LocalDateTime occurrence = currentDueOccurrence(startWallClock, repeat, zone, now);
        if (occurrence == null) {
            return;
        }
        Instant occurrenceAt = occurrence.toInstant(ZoneOffset.UTC);
        if (isAlreadyHandled(sentinel, occurrenceAt)) {
            return;
        }

        Instant fireAt = occurrence.atZone(zone).toInstant();
        boolean retry = schedule.getOfflineBehavior() == ScheduleOfflineBehavior.RETRY_ON_RECONNECT;
        if (retry && !now.isAfter(fireAt.plusSeconds(window))) {
            return;
        }
        record(schedule, machineId, occurrenceAt, now, ScheduleDeviceLocalTimeDispatchStatus.MISSED, sentinel);
        log.warn("DEVICE_LOCAL scheduleId={} machineId={} offline at occurrence fireAt={} (offlineBehavior={}) "
                + "— marked MISSED, advancing", schedule.getId(), machineId, fireAt, schedule.getOfflineBehavior());
    }

    private long fireWindowSeconds(ScheduleScript schedule) {
        if (schedule.getOfflineBehavior() == ScheduleOfflineBehavior.RETRY_ON_RECONNECT
                && schedule.getReconnectWindowSeconds() != null && schedule.getReconnectWindowSeconds() > 0) {
            return schedule.getReconnectWindowSeconds();
        }
        return catchupSeconds;
    }

    private static LocalDateTime currentDueOccurrence(LocalDateTime startWallClock, Long repeat, ZoneId zone,
                                                      Instant now) {
        Instant firstFireAt = startWallClock.atZone(zone).toInstant();
        if (now.isBefore(firstFireAt)) {
            return null;
        }
        if (repeat == null) {
            return startWallClock;
        }
        long elapsedSeconds = Duration.between(startWallClock, LocalDateTime.ofInstant(now, zone)).getSeconds();
        long k = Math.max(0, elapsedSeconds / repeat);
        LocalDateTime occurrence = startWallClock.plusSeconds(k * repeat);
        while (k > 0 && occurrence.atZone(zone).toInstant().isAfter(now)) {
            k--;
            occurrence = startWallClock.plusSeconds(k * repeat);
        }
        return occurrence;
    }

    private ZoneId parseZone(ScheduleScript schedule, String machineId, String zoneId) {
        try {
            return ZoneId.of(zoneId);
        } catch (DateTimeException e) {
            log.warn("DEVICE_LOCAL scheduleId={} machineId={} has invalid stored timezone '{}' — skipping",
                    schedule.getId(), machineId, zoneId);
            return null;
        }
    }

    private static boolean isHandled(ScheduleLocalMachineTimeDispatch sentinel) {
        return sentinel != null && sentinel.getLastOccurrenceAt() != null;
    }

    private static boolean isAlreadyHandled(ScheduleLocalMachineTimeDispatch sentinel, Instant occurrenceAt) {
        return sentinel != null && sentinel.getLastOccurrenceAt() != null && !occurrenceAt.isAfter(sentinel.getLastOccurrenceAt());
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

    private boolean record(ScheduleScript schedule, String machineId, Instant occurrenceAt, Instant now,
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
            log.debug("DEVICE_LOCAL sentinel written concurrently for scheduleId={} machineId={} — skipping",
                    schedule.getId(), machineId);
            return false;
        }
    }
}
