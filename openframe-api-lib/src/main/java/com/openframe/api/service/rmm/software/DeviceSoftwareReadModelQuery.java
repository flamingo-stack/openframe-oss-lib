package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.data.document.rmm.software.DeviceCve;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.TenantSoftware;
import com.openframe.data.repository.rmm.software.DeviceCveRepository;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.TenantSoftwareRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
public class DeviceSoftwareReadModelQuery {

    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final TenantSoftwareRepository tenantSoftwareRepository;
    private final DeviceCveRepository deviceCveRepository;

    public List<SoftwareResponse> rowsForDevice(String tenantId, String machineId,
                                                SoftwareFilterInput filter, String search) {
        List<DeviceSoftware> installed = deviceSoftwareRepository.findByTenantIdAndMachineId(tenantId, machineId);
        if (installed.isEmpty()) {
            return List.of();
        }

        Map<Long, Long> cveCountBySoftware = deviceCveRepository.findByTenantIdAndMachineId(tenantId, machineId).stream()
                .map(DeviceCve::getSoftwareId)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(id -> id, Collectors.counting()));

        List<Long> titleIds = installed.stream()
                .map(DeviceSoftware::getSoftwareTitleId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, Integer> devicesByTitle = titleIds.isEmpty() ? Map.of()
                : tenantSoftwareRepository.findByTenantIdAndSoftwareTitleIdIn(tenantId, titleIds).stream()
                .collect(Collectors.toMap(TenantSoftware::getSoftwareTitleId, TenantSoftware::getDevicesCount, (a, b) -> a));

        return installed.stream()
                .filter(ds -> matchesSearch(ds, search))
                .map(ds -> toResponse(ds, cveCountBySoftware, devicesByTitle))
                .filter(row -> matchesSources(row, filter))
                .toList();
    }

    private SoftwareResponse toResponse(DeviceSoftware ds, Map<Long, Long> cveCountBySoftware,
                                        Map<Long, Integer> devicesByTitle) {
        SoftwareResponse row = new SoftwareResponse();
        row.setId(ds.getSoftwareId() == null ? null : String.valueOf(ds.getSoftwareId()));
        row.setName(ds.getName());
        row.setCurrentVersion(ds.getVersion());
        row.setSource(FleetSoftwareCategory.of(ds.getSource()).source());
        row.setDevicesCount(devicesByTitle.get(ds.getSoftwareTitleId()));

        SoftwareVulnerabilitySummaryResponse summary = new SoftwareVulnerabilitySummaryResponse();
        summary.setCveCount(cveCountBySoftware.getOrDefault(ds.getSoftwareId(), 0L).intValue());
        row.setVulnerabilitySummary(summary);
        return row;
    }

    private boolean matchesSearch(DeviceSoftware ds, String search) {
        if (isBlank(search)) {
            return true;
        }
        return ds.getName() != null && ds.getName().toLowerCase().contains(search.toLowerCase());
    }

    private boolean matchesSources(SoftwareResponse row, SoftwareFilterInput filter) {
        if (filter == null || filter.getSources() == null || filter.getSources().isEmpty()) {
            return true;
        }
        return filter.getSources().contains(row.getSource());
    }
}
