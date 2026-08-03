package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * DEVICE_ONLINE trigger: when a device comes online (offline&rarr;online), fire — right then —
 * every ACTIVE, DEVICE_ONLINE-triggered schedule that targets that machine, on that one machine
 * only. A schedule targets the machine either explicitly (SPECIFIC, via a
 * {@link ScriptScheduleMachineAssigned} join row) or by rule (CRITERIA, matched live against the
 * device) — so a freshly-registered device that matches a criteria schedule runs it on first
 * online without any prior assignment.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerService {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleDeviceTargetResolver targetResolver;
    private final ScheduleFireDispatcher fireDispatcher;

    /** Run the machine's DEVICE_ONLINE schedules (specific + criteria) now, on that machine only. */
    public void onDeviceOnline(Machine machine) {
        String tenantId = machine.getTenantId();
        String machineId = machine.getMachineId();

        // Dedup by id so a schedule reachable via both paths fires once (deterministic order).
        Map<String, ScriptSchedule> due = new LinkedHashMap<>();
        for (ScriptSchedule schedule : specificDueSchedules(tenantId, machineId)) {
            due.putIfAbsent(schedule.getId(), schedule);
        }
        for (ScriptSchedule schedule : criteriaDueSchedules(tenantId, machine)) {
            due.putIfAbsent(schedule.getId(), schedule);
        }
        if (due.isEmpty()) {
            return;
        }

        log.info("Device online trigger: machineId={} tenantId={} firing {} DEVICE_ONLINE schedule(s)",
                machineId, tenantId, due.size());
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }
        Instant now = Instant.now();
        for (ScriptSchedule schedule : due.values()) {
            try {
                fireDispatcher.dispatch(schedule, List.of(machineId), now);
            } catch (Exception e) {
                log.error("Failed to fire DEVICE_ONLINE schedule scheduleId={} for machineId={}",
                        schedule.getId(), machineId, e);
            }
        }
    }

    /** ACTIVE, DEVICE_ONLINE schedules that explicitly assign this machine (SPECIFIC mode). */
    private List<ScriptSchedule> specificDueSchedules(String tenantId, String machineId) {
        List<String> scheduleIds = assignedRepository
                .findByTenantIdAndMachineId(tenantId, machineId).stream()
                .map(ScriptScheduleMachineAssigned::getScriptScheduleId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (scheduleIds.isEmpty()) {
            return List.of();
        }
        return scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds).stream()
                .filter(s -> s.getSelectionMode() != ScheduleDeviceSelectionMode.CRITERIA)
                .filter(s -> s.getTrigger() == ScriptScheduleTrigger.DEVICE_ONLINE)
                .filter(s -> s.getStatus() == ScriptStatus.ACTIVE)
                .toList();
    }

    /** ACTIVE, DEVICE_ONLINE criteria schedules whose rule matches this device. */
    private List<ScriptSchedule> criteriaDueSchedules(String tenantId, Machine machine) {
        return scheduleRepository.findByTenantIdAndSelectionModeAndTriggerAndStatus(
                        tenantId, ScheduleDeviceSelectionMode.CRITERIA,
                        ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE).stream()
                .filter(s -> targetResolver.matchesCriteria(s, machine))
                .toList();
    }
}
