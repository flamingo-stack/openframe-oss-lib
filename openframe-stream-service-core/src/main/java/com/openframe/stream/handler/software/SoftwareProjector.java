package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SoftwareProjector {

    private final SoftwareRepository softwareRepository;
    private final DeviceSoftwareRepository deviceSoftwareRepository;

    public void project(String tenantId, Long softwareTitleId) {
        if (tenantId == null || softwareTitleId == null) {
            return;
        }
        List<DeviceSoftware> installed = deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId);
        if (installed.isEmpty()) {
            softwareRepository.deleteByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId);
            return;
        }
        Set<String> cveIds = installed.stream()
                .map(DeviceSoftware::getVulnerabilities).filter(Objects::nonNull)
                .flatMap(List::stream).filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<Software.Installation> installations = installed.stream()
                .map(ds -> Software.Installation.builder()
                        .machineId(ds.getMachineId()).hostId(ds.getHostId())
                        .versions(ds.getVersions()).build())
                .toList();
        int devicesCount = (int) installations.stream()
                .map(Software.Installation::getMachineId).filter(Objects::nonNull).distinct().count();

        Software software = softwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId)
                .orElseGet(Software::new);
        software.setTenantId(tenantId);
        software.setSoftwareTitleId(softwareTitleId);
        applyName(software, installed.get(0));
        software.setLatestVersion(latestVersion(installed));
        software.setInstallations(installations);
        software.setCveIds(List.copyOf(cveIds));
        software.setDevicesCount(devicesCount);
        software.setCveCount(cveIds.size());
        software.setUpdatedAt(Instant.now());
        softwareRepository.save(software);
    }

    private void applyName(Software software, DeviceSoftware sample) {
        software.setName(sample.getName());
        software.setNameLower(sample.getName() == null ? null : sample.getName().toLowerCase());
        software.setSource(sample.getSource());
    }

    private String latestVersion(List<DeviceSoftware> installed) {
        return installed.stream()
                .map(DeviceSoftware::getVersions).filter(Objects::nonNull)
                .flatMap(List::stream).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(null);
    }
}
