package com.openframe.data.service.rmm.software;

import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.rmm.software.FleetSource;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import com.openframe.data.repository.rmm.software.DeviceSoftwareAggregationRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareTitleRollup;
import com.openframe.data.service.rmm.software.matching.InstalledProgram;
import com.openframe.data.service.rmm.software.matching.PackageMatch;
import com.openframe.data.service.rmm.software.matching.SoftwarePackageMatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SoftwareProjector {

    static final Duration MATCH_TTL = Duration.ofDays(1);

    private final SoftwareRepository softwareRepository;
    private final DeviceSoftwareAggregationRepository aggregationRepository;
    private final SoftwarePackageMatcher packageMatcher;

    public int project(String tenantId, Long softwareTitleId) {
        if (tenantId == null || softwareTitleId == null) {
            return 0;
        }
        Optional<SoftwareTitleRollup> rolledUp = aggregationRepository.rollUpTitle(tenantId, softwareTitleId);
        return rolledUp
                .map(rollup -> save(tenantId, softwareTitleId, rollup))
                .orElseGet(() -> remove(tenantId, softwareTitleId));
    }

    private int remove(String tenantId, Long softwareTitleId) {
        softwareRepository.deleteByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId);
        return 0;
    }

    private int save(String tenantId, Long softwareTitleId, SoftwareTitleRollup rollup) {
        Software software = softwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId)
                .orElseGet(Software::new);
        software.setTenantId(tenantId);
        software.setSoftwareTitleId(softwareTitleId);
        InstalledProgram program = programOf(rollup);
        boolean keysChanged = !hasKeysOf(software, program);
        applyName(software, rollup);
        applyProgram(software, program);
        software.setInstallerTypes(rollup.installerTypes());
        if (keysChanged || isStale(software.getPackageMatch())) {
            software.setPackageMatch(matchOf(program));
        }
        String latestVersion = latestVersion(rollup.versions());
        software.setLatestVersion(latestVersion);
        Map<String, Integer> devicesByVersion = rollup.devicesByVersion();
        String currentVersion = currentVersion(devicesByVersion);
        software.setCurrentVersion(currentVersion);
        software.setOlderVersionsCount(Math.max(0, devicesByVersion.size() - 1));
        software.setInstallations(rollup.installations());
        software.setDevicesCount(rollup.devicesCount());
        software.setCveCount(rollup.cveCount());
        software.setUpdatedAt(Instant.now());
        softwareRepository.save(software);
        return rollup.devicesCount();
    }

    private void applyName(Software software, SoftwareTitleRollup rollup) {
        software.setName(rollup.name());
        software.setNameLower(rollup.name() == null ? null : rollup.name().toLowerCase());
        software.setSource(rollup.source());
    }

    // the title's keys are the union over its devices: one program can sit under different ARP keys
    private static InstalledProgram programOf(SoftwareTitleRollup rollup) {
        return InstalledProgram.builder()
                .fleetSource(FleetSource.of(rollup.source()))
                .name(rollup.name())
                .publisher(rollup.vendor())
                .upgradeCode(rollup.upgradeCode())
                .productCodes(rollup.arpKeys())
                .packageFamilyNames(rollup.packageFamilyNames())
                .systemComponent(rollup.systemComponent())
                .build();
    }

    private static void applyProgram(Software software, InstalledProgram program) {
        software.setVendor(program.getPublisher());
        software.setUpgradeCode(program.getUpgradeCode());
        software.setArpKeys(program.getProductCodes());
        software.setPackageFamilyNames(program.getPackageFamilyNames());
        software.setSystemComponent(program.isSystemComponent());
    }

    // the handler projects every title of a host on every host_software event, so a title is matched again only
    // when a key changed or the match is older than MATCH_TTL: a catalog change still reaches it within a day
    private static boolean hasKeysOf(Software software, InstalledProgram program) {
        return FleetSource.of(software.getSource()) == program.getFleetSource()
                && Objects.equals(software.getName(), program.getName())
                && Objects.equals(software.getVendor(), program.getPublisher())
                && Objects.equals(software.getUpgradeCode(), program.getUpgradeCode())
                && Objects.equals(orEmpty(software.getArpKeys()), program.getProductCodes())
                && Objects.equals(orEmpty(software.getPackageFamilyNames()), program.getPackageFamilyNames())
                && Boolean.TRUE.equals(software.getSystemComponent()) == program.isSystemComponent();
    }

    private static boolean isStale(SoftwarePackageMatch match) {
        return match == null || match.getMatchedAt() == null
                || match.getMatchedAt().isBefore(Instant.now().minus(MATCH_TTL));
    }

    private SoftwarePackageMatch matchOf(InstalledProgram program) {
        PackageMatch match = packageMatcher.match(List.of(program)).get(program);
        return match == null ? null : match.toStored(Instant.now());
    }

    private static List<String> orEmpty(List<String> values) {
        return values == null ? List.of() : values;
    }

    private static String currentVersion(Map<String, Integer> devicesByVersion) {
        Comparator<Map.Entry<String, Integer>> byDevices = Map.Entry.comparingByValue();
        Comparator<Map.Entry<String, Integer>> thenNewer = byDevices
                .thenComparing(Map.Entry::getKey, SoftwareVersions::compare);
        return devicesByVersion.entrySet().stream()
                .max(thenNewer)
                .map(Map.Entry::getKey)
                .orElse(null);
    }

    private static String latestVersion(List<String> versions) {
        return versions.stream()
                .filter(Objects::nonNull)
                // numeric per segment: 10.0 is newer than 9.0
                .max(SoftwareVersions::compare).orElse(null);
    }
}
