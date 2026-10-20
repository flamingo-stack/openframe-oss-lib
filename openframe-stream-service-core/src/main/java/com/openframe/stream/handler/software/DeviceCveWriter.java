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

    public void upsert(String tenantId, String machineId, Long hostId, String cve, Long softwareId,
                       Long softwareTitleId, String installedVersion, String resolvedInVersion) {
        if (tenantId == null || machineId == null) {
            return;
        }
        DeviceCve deviceCve = deviceCveRepository
                .findByTenantIdAndMachineIdAndCveIdAndSoftwareId(tenantId, machineId, cve, softwareId)
                .orElseGet(DeviceCve::new);
        boolean isNew = deviceCve.getId() == null;
        Instant now = Instant.now();
        deviceCve.setTenantId(tenantId);
        deviceCve.setMachineId(machineId);
        deviceCve.setHostId(hostId);
        deviceCve.setCveId(cve);
        deviceCve.setSoftwareId(softwareId);
        deviceCve.setSoftwareTitleId(softwareTitleId);
        deviceCve.setInstalledVersion(installedVersion);
        deviceCve.setResolvedInVersion(resolvedInVersion);
        if (isNew || deviceCve.getDiscoveredAt() == null) {
            deviceCve.setDiscoveredAt(now);
        }
        deviceCve.setUpdatedAt(now);
        deviceCveRepository.save(deviceCve);
    }
}
