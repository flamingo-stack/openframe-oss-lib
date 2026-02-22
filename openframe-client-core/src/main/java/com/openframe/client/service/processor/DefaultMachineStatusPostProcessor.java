package com.openframe.client.service.processor;

import com.openframe.data.document.device.DeviceStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnMissingBean(value = MachineStatusPostProcessor.class, ignored = DefaultMachineStatusPostProcessor.class)
public class DefaultMachineStatusPostProcessor implements MachineStatusPostProcessor {

    @Override
    public void onStatusUpdated(String machineId, DeviceStatus previousStatus, DeviceStatus newStatus) {
        log.debug("Machine status updated: machineId={}, {} -> {}", machineId, previousStatus, newStatus);
    }
}
