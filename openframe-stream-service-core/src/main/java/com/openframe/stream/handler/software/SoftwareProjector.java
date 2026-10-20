package com.openframe.stream.handler.software;

import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.FleetSoftwareTitleRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
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
    private final DeviceCveRepository deviceCveRepository;
    private final FleetSoftwareTitleRepository fleetSoftwareTitleRepository;

    public void project(String tenantId, Long softwareTitleId) {
        if (tenantId == null || softwareTitleId == null) {
            return;
        }
        List<DeviceSoftware> installed = deviceSoftwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId);
        if (installed.isEmpty()) {
            softwareRepository.deleteByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId);
            return;
        }
        Set<String> cveIds = deviceCveRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId).stream()
                .map(DeviceCve::getCveId).filter(Objects::nonNull).collect(Collectors.toSet());

        List<Software.Installation> installations = installed.stream()
                .map(ds -> Software.Installation.builder()
                        .machineId(ds.getMachineId()).hostId(ds.getHostId()).softwareId(ds.getSoftwareId())
                        .version(ds.getVersion()).lastSeenAt(ds.getLastSeenAt()).build())
                .toList();
        int devicesCount = (int) installations.stream()
                .map(Software.Installation::getMachineId).filter(Objects::nonNull).distinct().count();

        Software software = softwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId)
                .orElseGet(Software::new);
        software.setTenantId(tenantId);
        software.setSoftwareTitleId(softwareTitleId);
        applyTitle(software, softwareTitleId, installed.get(0));
        software.setLatestVersion(latestVersion(installed));
        software.setInstallations(installations);
        software.setCveIds(List.copyOf(cveIds));
        software.setDevicesCount(devicesCount);
        software.setCveCount(cveIds.size());
        software.setUpdatedAt(Instant.now());
        softwareRepository.save(software);
    }

    private void applyTitle(Software software, Long softwareTitleId, DeviceSoftware sample) {
        software.setName(sample.getName());
        software.setNameLower(sample.getName() == null ? null : sample.getName().toLowerCase());
        software.setSource(sample.getSource());
        fleetSoftwareTitleRepository.findBySoftwareTitleId(softwareTitleId).ifPresent(title -> {
            software.setName(title.getName());
            software.setNameLower(title.getNameLower());
            software.setSource(title.getSource());
            software.setBrowser(title.getBrowser());
        });
    }

    private String latestVersion(List<DeviceSoftware> installed) {
        return installed.stream().map(DeviceSoftware::getVersion).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(null);
    }
}
