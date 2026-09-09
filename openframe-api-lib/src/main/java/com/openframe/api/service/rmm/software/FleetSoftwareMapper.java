package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

final class FleetSoftwareMapper {

    private FleetSoftwareMapper() {
    }

    static SoftwareResponse toResponse(SoftwareTitle title) {
        if (title == null) {
            return null;
        }
        List<SoftwareTitleVersion> versions = title.getVersions();
        SoftwareTitleVersion current = pickCurrentVersion(versions);
        return SoftwareResponse.builder()
                .id(Objects.toString(title.getId(), null))
                .name(title.getName())
                .source(FleetSoftwareCategory.of(title.getSource()).source())
                .currentVersion(current == null ? null : current.getVersion())
                .olderVersionsCount(olderVersionsCount(versions))
                .devicesCount(title.getHostsCount())
                .vulnerabilitySummary(rollUpVulnerabilities(versions))
                .build();
    }

    private static SoftwareTitleVersion pickCurrentVersion(List<SoftwareTitleVersion> versions) {
        if (versions == null || versions.isEmpty()) {
            return null;
        }
        return versions.stream()
                .max(Comparator.comparingInt(v -> v.getHostsCount() == null ? 0 : v.getHostsCount()))
                .orElse(versions.get(0));
    }

    private static Integer olderVersionsCount(List<SoftwareTitleVersion> versions) {
        if (versions == null || versions.isEmpty()) {
            return 0;
        }
        return versions.size() - 1;
    }

    private static SoftwareVulnerabilitySummaryResponse rollUpVulnerabilities(List<SoftwareTitleVersion> versions) {
        if (versions == null || versions.isEmpty()) {
            return null;
        }
        int total = versions.stream()
                .mapToInt(v -> v.getVulnerabilities() == null ? 0 : v.getVulnerabilities().size())
                .sum();
        if (total == 0) {
            return null;
        }
        return SoftwareVulnerabilitySummaryResponse.builder()
                .cveCount(total)
                .build();
    }
}
