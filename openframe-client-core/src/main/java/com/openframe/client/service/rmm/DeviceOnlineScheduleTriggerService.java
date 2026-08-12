package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerService {

    private final DeviceOnlineDispatchRepository dispatchRepository;

    public void onDeviceOnline(Machine machine) {
        String tenantId = machine.getTenantId();
        String machineId = machine.getMachineId();

        if (dispatchRepository.existsByTenantIdAndMachineId(tenantId, machineId)) {
            log.debug("Machine already onboarded (skip): machineId={} tenantId={}", machineId, tenantId);
            return;
        }

        try {
            dispatchRepository.save(DeviceFirstOnlineDispatch.builder()
                    .tenantId(tenantId)
                    .machineId(machineId)
                    .firstSeenAt(Instant.now())
                    .status(DeviceOnlineDispatchStatus.NEW)
                    .build());
            log.info("First DEVICE_ONLINE recorded: machineId={} tenantId={} — pending dispatch", machineId, tenantId);
        } catch (DuplicateKeyException e) {
            log.debug("Machine already onboarded (race, skip): machineId={} tenantId={}", machineId, tenantId);
        }
    }
}
