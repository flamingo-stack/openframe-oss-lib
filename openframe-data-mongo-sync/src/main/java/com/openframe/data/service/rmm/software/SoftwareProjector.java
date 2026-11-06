package com.openframe.data.service.rmm.software;

import com.openframe.core.util.SoftwareVersions;
import com.openframe.data.document.rmm.software.DeviceSoftware;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.repository.rmm.software.DeviceSoftwareRepository;
import com.openframe.data.repository.rmm.software.SoftwareRepository;
import com.openframe.data.service.rmm.software.matching.InstalledProgram;
import com.openframe.data.service.rmm.software.matching.PackageMatch;
import com.openframe.data.service.rmm.software.matching.SoftwarePackageMatcher;
import org.apache.commons.lang3.StringUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SoftwareProjector {

    private final SoftwareRepository softwareRepository;
    private final DeviceSoftwareRepository deviceSoftwareRepository;
    private final SoftwarePackageMatcher packageMatcher;

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
                        .machineId(ds.getMachineId())
                        .versions(ds.getVersions()).build())
                .toList();
        int devicesCount = (int) installations.stream()
                .map(Software.Installation::getMachineId).filter(Objects::nonNull).distinct().count();

        Software software = softwareRepository.findByTenantIdAndSoftwareTitleId(tenantId, softwareTitleId)
                .orElseGet(Software::new);
        software.setTenantId(tenantId);
        software.setSoftwareTitleId(softwareTitleId);
        DeviceSoftware sample = installed.getFirst();
        applyName(software, sample);
        applyProgram(software, programOf(sample, installed));
        software.setInstallerTypes(union(installed, DeviceSoftware::getInstallerTypes));
        software.setLatestVersion(latestVersion(installed));
        software.setInstallations(installations);
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

    // the title's keys are the union over its devices: one program can sit under different ARP keys
    private static InstalledProgram programOf(DeviceSoftware sample, List<DeviceSoftware> installed) {
        return InstalledProgram.builder()
                .fleetSource(sample.getSource())
                .name(sample.getName())
                .publisher(first(installed, DeviceSoftware::getVendor))
                .upgradeCode(first(installed, DeviceSoftware::getUpgradeCode))
                .productCodes(union(installed, DeviceSoftware::getArpKeys))
                .packageFamilyNames(union(installed, DeviceSoftware::getPackageFamilyNames))
                .systemComponent(allFlagged(installed, DeviceSoftware::getSystemComponent))
                .build();
    }

    private void applyProgram(Software software, InstalledProgram program) {
        software.setVendor(program.getPublisher());
        software.setUpgradeCode(program.getUpgradeCode());
        software.setArpKeys(program.getProductCodes());
        software.setPackageFamilyNames(program.getPackageFamilyNames());
        software.setSystemComponent(program.isSystemComponent());
        software.setPackageMatch(packageMatcher.match(program).map(PackageMatch::toStored).orElse(null));
    }

    private static String first(List<DeviceSoftware> installed, Function<DeviceSoftware, String> value) {
        return installed.stream().map(value).filter(StringUtils::isNotBlank).findFirst().orElse(null);
    }

    private static List<String> union(List<DeviceSoftware> installed, Function<DeviceSoftware, List<String>> values) {
        return installed.stream()
                .map(values).filter(Objects::nonNull)
                .flatMap(List::stream).filter(StringUtils::isNotBlank)
                .distinct()
                .toList();
    }

    // true only when every device that reports the flag reports it set
    private static boolean allFlagged(List<DeviceSoftware> installed, Function<DeviceSoftware, Boolean> flag) {
        List<Boolean> flags = installed.stream().map(flag).filter(Objects::nonNull).toList();
        return !flags.isEmpty() && flags.stream().allMatch(Boolean::booleanValue);
    }

    private String latestVersion(List<DeviceSoftware> installed) {
        return installed.stream()
                .map(DeviceSoftware::getVersions).filter(Objects::nonNull)
                .flatMap(List::stream).filter(Objects::nonNull)
                // numeric per segment: 10.0 is newer than 9.0
                .max(SoftwareVersions::compare).orElse(null);
    }
}
