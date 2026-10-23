package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
@RequiredArgsConstructor
public class DeviceCveWriter {

    private final DeviceCveRepository deviceCveRepository;

    public void upsert(String tenantId, String machineId, Long hostId, String cve,
                       Long softwareTitleId, String name, String installedVersion) {
        if (tenantId == null || machineId == null) {
            return;
        }
        DeviceCve deviceCve = deviceCveRepository
                .findByTenantIdAndMachineIdAndCveIdAndSoftwareTitleId(tenantId, machineId, cve, softwareTitleId)
                .orElseGet(DeviceCve::new);
        boolean isNew = deviceCve.getId() == null;
        Instant now = Instant.now();
        deviceCve.setTenantId(tenantId);
        deviceCve.setMachineId(machineId);
        deviceCve.setHostId(hostId);
        deviceCve.setCveId(cve);
        deviceCve.setSoftwareTitleId(softwareTitleId);
        deviceCve.setName(name);
        deviceCve.setInstalledVersion(installedVersion);
        if (isNew || deviceCve.getDiscoveredAt() == null) {
            deviceCve.setDiscoveredAt(now);
        }
        deviceCve.setUpdatedAt(now);
        deviceCveRepository.save(deviceCve);
    }
}
