package com.openframe.api.service.processor;

import com.openframe.data.document.device.Machine;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default implementation of DeviceStatusProcessor for API service.
 * This bean will be used if no other implementation is provided.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = DeviceStatusProcessor.class, ignored = DefaultDeviceStatusProcessor.class)
public class DefaultDeviceStatusProcessor implements DeviceStatusProcessor {

    @Override
    public void postProcessStatusUpdated(Machine machine) {
        log.debug("Device status updated: {}, new status: {}", machine.getMachineId(), machine.getStatus());
    }
}
