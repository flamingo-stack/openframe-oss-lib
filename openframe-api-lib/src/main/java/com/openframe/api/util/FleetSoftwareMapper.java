package com.openframe.api.util;

import com.openframe.api.dto.rmm.software.SoftwareResponse;
import com.openframe.api.dto.rmm.software.SoftwareVulnerabilitySummaryResponse;
import com.openframe.api.service.rmm.fleet.FleetSoftwareCategory;
import com.openframe.api.service.rmm.fleet.FleetSoftwareType;
import com.openframe.core.util.SoftwareVersions;
import com.openframe.sdk.fleetmdm.model.SoftwareTitle;
import com.openframe.sdk.fleetmdm.model.SoftwareTitleVersion;
import lombok.experimental.UtilityClass;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

@UtilityClass
public class FleetSoftwareMapper {

    public static SoftwareResponse toResponse(SoftwareTitle title) {
        if (title == null) {
            return null;
        }
        List<SoftwareTitleVersion> versions = title.getVersions();
        SoftwareTitleVersion current = pickCurrentVersion(versions);
        return SoftwareResponse.builder()
                .id(Objects.toString(title.getId(), null))
                .name(title.getName())
                .source(FleetSoftwareCategory.of(title.getSource()).source())
                .type(FleetSoftwareType.of(title.getSource()))
                .currentVersion(current == null ? null : current.getVersion())
                .latestVersion(latestVersion(versions))
                .olderVersionsCount(olderVersionsCount(versions))
                .devicesCount(title.getHostsCount())
                .vulnerabilitySummary(rollUpVulnerabilities(versions))
                .fleetSource(title.getSource())
                .publisher(firstText(versions, SoftwareTitleVersion::getVendor))
                .upgradeCode(title.getUpgradeCode())
                .build();
    }

    public static <T> String firstText(List<T> versions, Function<T, String> value) {
        return versions == null ? null : versions.stream().map(value).filter(StringUtils::hasText).findFirst().orElse(null);
    }

    public static <T> List<String> distinctText(List<T> versions, Function<T, String> value) {
        return versions == null ? List.of() : versions.stream().map(value).filter(StringUtils::hasText).distinct().toList();
    }

    // null until a version reports the flag; true only when every reporting version has it set
    public static <T> Boolean allFlagged(List<T> versions, Function<T, Boolean> flag) {
        if (versions == null) {
            return null;
        }
        List<Boolean> flags = versions.stream().map(flag).filter(Objects::nonNull).toList();
        return flags.isEmpty() ? null : flags.stream().allMatch(Boolean::booleanValue);
    }

    // the highest version installed on the tenant's devices: Fleet does not say what the newest release is
    private static String latestVersion(List<SoftwareTitleVersion> versions) {
        return versions == null ? null : versions.stream()
                .map(SoftwareTitleVersion::getVersion)
                .filter(Objects::nonNull)
                .max(SoftwareVersions::compare)
                .orElse(null);
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
