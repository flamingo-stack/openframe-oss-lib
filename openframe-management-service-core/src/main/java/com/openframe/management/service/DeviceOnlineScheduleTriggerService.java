package com.openframe.management.service;

import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * DEVICE_ONLINE trigger: when an assigned device comes online (offline→online), fire — right
 * then — every ACTIVE, DEVICE_ONLINE-triggered schedule that targets that machine, on that one
 * machine only.
 *
 * <p>Fires on EVERY offline→online transition (no debounce, by product decision). Only schedules
 * that genuinely list this machine in their assignment are considered — the reverse lookup is the
 * authority. Per-schedule errors are isolated so one broken schedule doesn't block the rest.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerService {

    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleFireDispatcher fireDispatcher;

    /** Run the machine's assigned DEVICE_ONLINE schedules now, on that machine only. */
    public void onDeviceOnline(String tenantId, String machineId) {
        List<String> scheduleIds = assignedRepository
                .findByTenantIdAndMachineIdsContaining(tenantId, machineId).stream()
                .map(ScriptScheduleMachineAssigned::getScriptScheduleId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (scheduleIds.isEmpty()) {
            return;
        }

        List<ScriptSchedule> due = scheduleRepository.findByTenantIdAndIdIn(tenantId, scheduleIds).stream()
                .filter(s -> s.getTrigger() == ScriptScheduleTrigger.DEVICE_ONLINE)
                .filter(s -> s.getStatus() == ScriptStatus.ACTIVE)
                .toList();
        if (due.isEmpty()) {
            return;
        }

        log.info("Device online trigger: machineId={} tenantId={} firing {} DEVICE_ONLINE schedule(s)",
                machineId, tenantId, due.size());
        Instant now = Instant.now();
        for (ScriptSchedule schedule : due) {
            try {
                fireDispatcher.dispatch(schedule, List.of(machineId), now);
            } catch (Exception e) {
                log.error("Failed to fire DEVICE_ONLINE schedule scheduleId={} for machineId={}",
                        schedule.getId(), machineId, e);
            }
        }
    }
}
