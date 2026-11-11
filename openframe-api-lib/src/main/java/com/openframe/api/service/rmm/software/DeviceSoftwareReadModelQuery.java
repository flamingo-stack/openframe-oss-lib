package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareType;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.api.service.rmm.fleet.FleetSoftwareType;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;

// The software of one device from the read model, shaped like the Fleet path's rows; the caller filters them.
@Component
@RequiredArgsConstructor
public class DeviceSoftwareReadModelQuery {

    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwareRepository softwareRepository;

    public List<SoftwareResponse> rowsForDevice(String tenantId, String machineId, String search) {
        List<DeviceSoftware> installed = deviceSoftwareRepository.findByTenantIdAndMachineId(tenantId, machineId).stream()
                .filter(DeviceSoftware::isMachineConnected)
                .filter(row -> row.getSoftwareTitleId() != null)
                .toList();
        if (installed.isEmpty()) {
            return List.of();
        }
        List<Long> titleIds = installed.stream().map(DeviceSoftware::getSoftwareTitleId).distinct().toList();
        Map<Long, Software> softwareByTitle = softwareRepository.findByTenantIdAndSoftwareTitleIdIn(tenantId, titleIds)
                .stream()
                .collect(Collectors.toMap(Software::getSoftwareTitleId, Function.identity(), (a, b) -> a));
        return installed.stream()
                .filter(row -> softwareByTitle.containsKey(row.getSoftwareTitleId()))
                .map(row -> toResponse(softwareByTitle.get(row.getSoftwareTitleId()), row))
                .filter(row -> matchesSearch(row, search))
                .toList();
    }

    private static SoftwareResponse toResponse(Software sw, DeviceSoftware installed) {
        List<String> versions = versionsOnDevice(installed);
        String currentVersion = versions.isEmpty() ? null : versions.getFirst();
        Long titleId = sw.getSoftwareTitleId();
        String id = titleId == null ? null : titleId.toString();
        String fleetSource = sw.getSource();
        FleetSoftwareCategory category = FleetSoftwareCategory.of(fleetSource);
        SoftwareType type = FleetSoftwareType.of(fleetSource);
        int olderVersions = Math.max(0, versions.size() - 1);

        SoftwareVulnerabilitySummaryResponse summary = new SoftwareVulnerabilitySummaryResponse();
        summary.setCveCount(sw.getCveCount());

        SoftwareResponse row = new SoftwareResponse();
        row.setId(id);
        row.setName(sw.getName());
        row.setCurrentVersion(currentVersion);
        row.setOlderVersionsCount(olderVersions);
        row.setSource(category.source());
        row.setFleetSource(FleetSource.of(fleetSource));
        row.setPublisher(sw.getVendor());
        row.setUpgradeCode(sw.getUpgradeCode());
        row.setProductCodes(sw.getArpKeys());
        row.setPackageFamilyNames(sw.getPackageFamilyNames());
        row.setSystemComponent(sw.getSystemComponent());
        row.setPackageMatch(sw.getPackageMatch());
        row.setType(type);
        row.setDevicesCount(sw.getDevicesCount());
        row.setVulnerabilitySummary(summary);
        return row;
    }

    private static List<String> versionsOnDevice(DeviceSoftware installed) {
        if (installed.getVersions() == null) {
            return List.of();
        }
        return installed.getVersions().stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private static boolean matchesSearch(SoftwareResponse row, String search) {
        if (isBlank(search)) {
            return true;
        }
        String name = row.getName();
        return name != null && name.toLowerCase().contains(search.toLowerCase());
    }
}
