package com.openframe.client.listener.rmm;

import com.openframe.client.event.DeviceCameOnlineEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineCriteriaArmingListener {

    private final ScriptScheduleRepository scheduleRepository;
    private final ScheduleDeviceTargetResolver targetResolver;
    private final DeviceOnlineDispatchRepository dispatchRepository;

    @EventListener
    public void onDeviceCameOnline(DeviceCameOnlineEvent event) {
        Machine machine = event.getMachine();
        if (machine == null || machine.getTenantId() == null || machine.getMachineId() == null) {
            return;
        }
        String tenantId = machine.getTenantId();
        List<ScheduleScript> schedules = scheduleRepository.findByTenantIdAndTriggerAndStatus(
                tenantId, ScheduleScriptTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE);
        for (ScheduleScript schedule : schedules) {
            if (targetResolver.matchesCriteria(schedule, machine)) {
                armIfAbsent(tenantId, machine.getMachineId(), schedule.getId());
            }
        }
    }

    private void armIfAbsent(String tenantId, String machineId, String scheduleId) {
        if (dispatchRepository.findByTenantIdAndMachineIdAndScheduleId(tenantId, machineId, scheduleId).isPresent()) {
            return;   // already armed/fired once for this (schedule, device)
        }
        try {
            dispatchRepository.save(DeviceFirstOnlineDispatch.builder()
                    .tenantId(tenantId)
                    .machineId(machineId)
                    .scheduleId(scheduleId)
                    .firstSeenAt(Instant.now())
                    .status(DeviceOnlineDispatchStatus.NEW)
                    .build());
            log.info("Armed DEVICE_ONLINE (criteria) sentinel: machineId={} scheduleId={} tenantId={}",
                    machineId, scheduleId, tenantId);
        } catch (DuplicateKeyException raced) {
            log.debug("DEVICE_ONLINE (criteria) sentinel already armed concurrently: machineId={} scheduleId={} tenantId={}",
                    machineId, scheduleId, tenantId);
        }
    }
}
