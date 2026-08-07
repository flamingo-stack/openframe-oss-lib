package com.openframe.client.service.rmm;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.MachineFirstOnlineDispatch;
import com.openframe.data.repository.device.MachineFirstOnlineDispatchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceOnlineScheduleTriggerService {

    private final MachineFirstOnlineDispatchRepository dispatchRepository;

    public void onDeviceOnline(Machine machine) {
        String tenantId = machine.getTenantId();
        String machineId = machine.getMachineId();
        try {
            dispatchRepository.save(MachineFirstOnlineDispatch.builder()
                    .tenantId(tenantId)
                    .machineId(machineId)
                    .firstSeenAt(Instant.now())
                    .build());
            log.info("First DEVICE_ONLINE recorded: machineId={} tenantId={} — pending dispatch",
                    machineId, tenantId);
        } catch (DuplicateKeyException e) {
            // Already recorded — subsequent OFFLINE→ONLINE events must NOT re-fire schedules.
            log.debug("Machine already onboarded (skip): machineId={} tenantId={}", machineId, tenantId);
        }
    }
}
