package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareFilterInput;
import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

import static org.apache.commons.lang3.StringUtils.isBlank;

@Component
@RequiredArgsConstructor
public class DeviceSoftwareReadModelQuery {

    private final SoftwareRepository softwareRepository;

    public List<SoftwareResponse> rowsForDevice(String tenantId, String machineId,
                                                SoftwareFilterInput filter, String search) {
        return softwareRepository.findByTenantIdAndInstallationsMachineId(tenantId, machineId).stream()
                .map(sw -> toResponse(sw, machineId))
                .filter(row -> matchesSearch(row, search))
                .filter(row -> matchesSources(row, filter))
                .toList();
    }

    private SoftwareResponse toResponse(Software sw, String machineId) {
        SoftwareResponse row = new SoftwareResponse();
        row.setId(sw.getSoftwareTitleId() == null ? null : String.valueOf(sw.getSoftwareTitleId()));
        row.setName(sw.getName());
        row.setCurrentVersion(versionOnDevice(sw, machineId));
        row.setSource(FleetSoftwareCategory.of(sw.getSource()).source());
        row.setDevicesCount(sw.getDevicesCount());

        SoftwareVulnerabilitySummaryResponse summary = new SoftwareVulnerabilitySummaryResponse();
        summary.setCveCount(sw.getCveCount());
        row.setVulnerabilitySummary(summary);
        return row;
    }

    private String versionOnDevice(Software sw, String machineId) {
        if (sw.getInstallations() == null) {
            return null;
        }
        return sw.getInstallations().stream()
                .filter(i -> machineId.equals(i.getMachineId()))
                .map(Software.Installation::getVersion)
                .findFirst().orElse(null);
    }

    private boolean matchesSearch(SoftwareResponse row, String search) {
        if (isBlank(search)) {
            return true;
        }
        return row.getName() != null && row.getName().toLowerCase().contains(search.toLowerCase());
    }

    private boolean matchesSources(SoftwareResponse row, SoftwareFilterInput filter) {
        if (filter == null || filter.getSources() == null || filter.getSources().isEmpty()) {
            return true;
        }
        return filter.getSources().contains(row.getSource());
    }
}
