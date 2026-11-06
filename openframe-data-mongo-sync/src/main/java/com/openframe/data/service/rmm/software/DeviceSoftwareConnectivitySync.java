package com.openframe.data.service.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeviceSoftwareConnectivitySync {

    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareProjector softwareProjector;
    private final VulnerabilityProjector vulnerabilityProjector;

    public void onConnectivityChanged(String tenantId, String machineId, boolean connected) {
        if (tenantId == null || machineId == null) {
            return;
        }
        List<DeviceSoftware> rows = deviceSoftwareRepository.findByTenantIdAndMachineId(tenantId, machineId);
        if (rows.isEmpty()) {
            return;
        }
        Set<Long> affectedTitles = new HashSet<>();
        Set<String> affectedCves = new HashSet<>();
        int changed = 0;
        for (DeviceSoftware row : rows) {
            if (row.isMachineConnected() == connected) {
                continue;
            }
            row.setMachineConnected(connected);
            deviceSoftwareRepository.save(row);
            changed++;
            if (row.getSoftwareTitleId() != null) {
                affectedTitles.add(row.getSoftwareTitleId());
            }
            if (row.getVulnerabilities() != null) {
                affectedCves.addAll(row.getVulnerabilities());
            }
        }
        if (changed == 0) {
            return;
        }
        affectedTitles.forEach(titleId -> softwareProjector.project(tenantId, titleId));
        affectedCves.forEach(cve -> vulnerabilityProjector.project(tenantId, cve));
        int titleCount = affectedTitles.size();
        int cveCount = affectedCves.size();
        log.info("Machine {} tenantId={} connectivity -> {}: updated {} device_software row(s), re-projected {} title(s), {} CVE(s)",
                machineId, tenantId, connected, changed, titleCount, cveCount);
    }
}
